"""LLM Provider abstraction and client implementations.

Architectural Rule:
The LLM is strictly an interface layer (parsing and explanations).
It is NEVER used to decide scheduling validity or booking conflicts.
If LLM is unavailable or disabled, the application seamlessly falls back
to rule-based parsers and template-based explanations.
"""

from abc import ABC, abstractmethod
from typing import Any
import os
import httpx

from backend.app.core.config import get_settings
from backend.app.core.logging import get_logger

logger = get_logger("ai.llm_client")


class LLMUnavailable(Exception):
    """Raised when LLM service is disabled, unconfigured, or unreachable."""
    pass


class LLMClient(ABC):
    """Abstract interface for LLM operations."""

    @abstractmethod
    async def complete(
        self,
        prompt: str,
        system_instruction: str | None = None,
        temperature: float = 0.1,
        response_schema: dict[str, Any] | None = None,
    ) -> str:
        """Generate text completion from LLM."""
        pass


class NullLLM(LLMClient):
    """Fallback LLM client used when no API key is set or when LLM is disabled.

    Always raises LLMUnavailable so all callers cleanly trigger their
    deterministic/rule-based fallbacks.
    """

    def __init__(self, reason: str = "LLM is disabled or API key not configured"):
        self.reason = reason

    async def complete(
        self,
        prompt: str,
        system_instruction: str | None = None,
        temperature: float = 0.1,
        response_schema: dict[str, Any] | None = None,
    ) -> str:
        logger.info(f"NullLLM invoked: {self.reason}")
        raise LLMUnavailable(self.reason)


class GeminiLLMClient(LLMClient):
    """Real LLM implementation using Google Gemini API."""

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    async def complete(
        self,
        prompt: str,
        system_instruction: str | None = None,
        temperature: float = 0.1,
        response_schema: dict[str, Any] | None = None,
    ) -> str:
        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"
        contents = [{"role": "user", "parts": [{"text": prompt}]}]
        body: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
            },
        }

        if system_instruction:
            body["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        if response_schema:
            body["generationConfig"]["responseMimeType"] = "application/json"
            body["generationConfig"]["responseSchema"] = response_schema

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=body)
                if res.status_code != 200:
                    logger.error(f"Gemini API error {res.status_code}: {res.text}")
                    raise LLMUnavailable(f"Gemini API returned status {res.status_code}")
                data = res.json()
                text = (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                return text
        except httpx.RequestError as e:
            logger.error(f"Network error contacting LLM: {e}")
            raise LLMUnavailable(f"Network error contacting LLM: {str(e)}")


def get_llm_client() -> LLMClient:
    """Factory to acquire the active LLM client based on configuration.

    If LLM_API_KEY is unset or empty, returns NullLLM.
    """
    settings = get_settings()
    api_key = settings.LLM_API_KEY or os.environ.get("LLM_API_KEY", "")

    if not api_key:
        return NullLLM("No LLM_API_KEY configured in environment")

    return GeminiLLMClient(api_key=api_key, model=settings.LLM_MODEL)
