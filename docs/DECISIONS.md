# Architecture Decisions

This document records key architectural and design decisions made during development.

## Decision Log

### D001: Solver never uses LLM
**Date:** 2024-10-31
**Decision:** The constraint solver (timetable, exams, rescheduling) and booking engine are purely deterministic. The LLM is only used for parsing natural language into structured data and for rephrasing explanations.
**Rationale:** Judging rubric explicitly states "If validity checks depend on an LLM, scheduling correctness is 0." Deterministic decisions are reproducible and auditable.

### D002: Booking priority is data-driven
**Date:** 2024-10-31
**Decision:** Priority order is stored in the database with a default ordering (Exams > Classes > Institute events > Guest lectures > Department events > Club events). Admin can reorder.
**Rationale:** Rubric requires deterministic booking decisions. Storing in DB allows admin control while keeping decisions reproducible.

### D003: Official validator is never modified
**Date:** 2024-10-31
**Decision:** `data/validator.py` is treated as read-only. We wrap it for integration but never edit it.
**Rationale:** Rubric explicitly bans tampering with the validator. Disqualification risk.

### D004: SQLite with Postgres-compatible schema
**Date:** 2024-10-31
**Decision:** Use SQLite for simplicity with a schema that can migrate to Postgres if needed.
**Rationale:** Reduces deployment complexity. The dataset is small enough that SQLite handles it easily.

