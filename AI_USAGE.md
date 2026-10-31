# AI Usage and Transparency Declaration

> **Mandatory Hackathon Compliance Statement:**
> Undeclared AI use carries a 10-mark penalty. This document comprehensively declares all AI tools used during development, models called at runtime, the scope and constraints on AI operations, and explicit architectural boundaries where AI is strictly prohibited from making decisions.

---

## 1. Architectural Boundary: What AI is NEVER Allowed to Decide

In strict compliance with the hackathon rules (**"If validity checks depend on an LLM, scheduling correctness is 0"**):

1. **Scheduling Feasibility:** The LLM NEVER places sessions, creates timetables, or resolves clashes. All scheduling is executed by Google OR-Tools CP-SAT constraint programming.
2. **Hard and Soft Constraint Validation:** The LLM NEVER checks or certifies compliance. Validation is performed by the deterministic Python validator.
3. **Venue Booking Decisions:** The LLM NEVER approves or rejects booking requests. Booking outcomes are decided by a deterministic priority hierarchy (Exams > Classes > Events).
4. **Disruption Re-solving:** The LLM NEVER shifts sessions during disruptions. Rescheduling is computed by the CP-SAT minimal-move solver.
5. **Role and Permission Authorization:** User identity, priority level, and permissions are derived strictly from cryptographically verified JWT tokens and database roles, NEVER from user-supplied prompt text (e.g., "I am the Dean" prompt injections are ignored).

---

## 2. Runtime AI Capabilities: What AI IS Used For

When an LLM API key is configured, the system uses AI exclusively as a natural language **interface and explanation layer**:

| Feature | Model / API | Purpose | Deterministic Guardrail |
|---------|-------------|---------|-------------------------|
| **Booking Request Parser** | Gemini 2.0 Flash (`backend/app/ai/booking_parser.py`) | Extracts structured parameters (dates, room types, attendee counts, Hinglish terms) into a `BookingDraft` schema. | Parsed draft is presented in an editable UI form for user confirmation; deterministic booking engine makes the actual decision. |
| **Faculty Assistant Intent Parser** | Gemini 2.0 Flash (`backend/app/ai/faculty_assistant.py`) | Parses faculty natural language requests (e.g., leave, room change request) into disruption intents. | Converted into disruption objects; CP-SAT solver computes minimal-move schedule; admin approval required. |
| **Schedule / Decision Explainer** | Gemini 2.0 Flash (`backend/app/ai/explainer.py`) | Rephrases deterministic reason records and solver infeasibility cores into human-friendly explanations. | LLM receives strict ground-truth facts from solver/engine; cannot invent reasons; falls back to template text if offline. |

---

## 3. Offline Resilience: Operation with AI Disabled (`NullLLM`)

The platform is designed to operate with **100% functionality** when AI is disabled (`LLM_API_KEY=""`):
- **Rule-Based Fallback Parser:** Comprehensive regex and keyword dictionaries for dates, times, room types, and Hinglish terminology (`aaj`, `kal`, `parso`, `baje`).
- **Template-Based Explanations:** Code-generated explanation strings for why any slot was rejected or chosen.
- **Manual Booking UI:** Full form controls for direct entry without natural language.

---

## 4. Development-Time AI Tools Used to Build the Platform

The following AI assistants and developer tools were used during development:

| Tool | Provider | Purpose / Scope |
|------|----------|-----------------|
| **Antigravity / Gemini Coding Assistant** | Google DeepMind | Pair-programming, scaffolding project structure, writing CP-SAT models, implementing React components, and authoring automated tests. |
| **Claude Code (Anthropic)** | Anthropic | Architecture reviews, plan validation, and documentation generation. |
| **Gemini 2.0 Flash API** | Google | Runtime inference testing for natural language booking parsing and intent extraction. |

---

## 5. Prompt Directory Reference

All runtime system prompts and few-shot examples are strictly versioned in:
- `backend/app/ai/prompts/booking_parser.txt`
- `backend/app/ai/prompts/faculty_assistant.txt`
- `backend/app/ai/prompts/explainer.txt`
