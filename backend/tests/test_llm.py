"""Tests for LLMClient provider abstraction and NullLLM fallback."""

import pytest
from backend.app.ai.llm_client import NullLLM, LLMUnavailable, get_llm_client


@pytest.mark.asyncio
async def test_null_llm_raises_llm_unavailable():
    """NullLLM must raise LLMUnavailable so callers can trigger rule-based fallback."""
    client = NullLLM("Testing offline mode")
    with pytest.raises(LLMUnavailable) as exc_info:
        await client.complete("Hello world")
    assert "Testing offline mode" in str(exc_info.value)


def test_get_llm_client_returns_null_llm_when_no_key(monkeypatch):
    """When LLM_API_KEY is empty, get_llm_client returns NullLLM."""
    monkeypatch.setenv("LLM_API_KEY", "")
    from backend.app.core.config import get_settings
    get_settings.cache_clear()

    client = get_llm_client()
    assert isinstance(client, NullLLM)
