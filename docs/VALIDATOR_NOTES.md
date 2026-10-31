# CIT Scheduling & Venue Management - Official Validator Specifications

> **Source of Truth Reference Document**
> This document formalises all constraints, evaluation criteria, scoring metrics, and JSON export formats checked by the official hackathon validator (`validator.py`). All solvers and booking algorithms must adhere strictly to these definitions.

---

## 1. Hard Constraints (Feasibility - 25 Marks)

Any single hard violation deducts **3 marks** from scheduling correctness (25 marks max; down to 0). A valid schedule must achieve **0 hard violations**.

| ID | Constraint Name | Description | Mathematical / Logic Rule |
|----|-----------------|-------------|---------------------------|
| **H1** | **Room Non-Overlap** | No room may host two sessions simultaneously. | $\forall r, \forall (s_1, s_2), \text{Overlap}(s_1, s_2) \implies s_1.room \neq s_2.room$ |
| **H2** | **Faculty Non-Overlap** | No faculty may teach more than one session at any period. | $\forall f, \forall (s_1, s_2), \text{Overlap}(s_1, s_2) \implies s_1.faculty \neq s_2.faculty$ |
| **H3** | **Group Non-Overlap** | No student group may attend more than one session at any period. | $\forall g, \forall (s_1, s_2), \text{Overlap}(s_1, s_2) \implies s_1.group \neq s_2.group$ |
| **H4** | **Room Type Suitability** | Session must be placed in a room whose type matches the session's required `room_type`. | $s.room.type \in s.allowed\_room\_types$ (e.g. `computer_lab`, `physics_lab`, `auditorium`, `classroom`) |
| **H5** | **Room Capacity (Teaching)** | Room capacity must accommodate enrolled students. | $s.room.capacity \ge s.enrolled\_count$ |
| **H6** | **Accessibility Compliance** | If a session requires wheelchair accessibility, the assigned room must be accessible. | $s.requires\_accessible \implies s.room.is\_accessible = \text{True}$ |
| **H7** | **Teaching Window** | Regular classes and labs may only run in teaching periods **P1 through P9**. | $s.start\_period \ge 1 \land (s.start\_period + s.duration - 1) \le 9$ (Periods P10–P13 are strictly reserved for events) |
| **H8** | **Lunch Break Preservation** | No teaching session may straddle the institute lunch break (13:00–14:00, between P5 and P6). | $s.start\_period \le 5 \implies (s.start\_period + s.duration - 1) \le 5$ |
| **H9** | **3-Hour Lab Slots** | 3-hour lab sessions may **only** start at **P2** (ending P4) or **P6** (ending P8). | $s.duration = 3 \implies s.start\_period \in \{2, 6\}$ |
| **H10** | **Faculty Availability & Maintenance** | Sessions cannot be scheduled during faculty leave/unavailability or room maintenance windows. | $(s.day, p) \notin f.unavailable\_slots \land (s.day, p) \notin r.maintenance\_slots, \forall p \in [start, end]$ |
| **H11** | **Faculty Daily Load** | A faculty member cannot exceed **4 hours** of teaching in a single day. | $\sum_{s \in \text{DaySessions}(f, d)} s.duration \le 4$ |
| **H12** | **Fixed Slots** | All pre-assigned fixed slots in the dataset must be honoured as immutable constants. | $s.is\_fixed \implies s.day = s.fixed\_day \land s.start\_period = s.fixed\_period \land s.room = s.fixed\_room$ |
| **H13** | **Elective Baskets** | All course sessions belonging to the same elective basket must share the exact same day and start period. | $\forall s_i, s_j \in \text{Basket}_k, s_i.day = s_j.day \land s_i.start\_period = s_j.start\_period$ (Student groups within the basket do not clash with each other, but clash with all other external sessions) |
| **H14** | **Combined Lectures** | Combined lectures must reserve all participating student groups simultaneously. | Overlaps block $\bigcup g \in s.enrolled\_groups$ |
| **H15** | **All Sessions Placed** | All 189 weekly sessions (243 teaching hours) must be scheduled exactly once. | $|\text{ScheduledSessions}| = 189$ with identical durations |

---

## 2. Soft Constraint Penalties (Optimisation - 10 Marks)

The solver minimises the total soft penalty. Exact weights enforced by `validator.py`:

| Metric | Penalty Weight | Description | Calculation |
|--------|----------------|-------------|-------------|
| **S1** | **2 per hour** | Faculty avoided times | For each hour a faculty teaches in a slot listed in their `avoid_times` preference. |
| **S2** | **1 per period** | Student group idle gaps | For each idle gap period between a student group's classes on a day (lunch between P5 and P6 is **not** counted as a gap). |
| **S3** | **3 per hour** | Group daily load > 6h | For every teaching hour exceeding 6 hours for any student group on a single day. |
| **S4** | **3 per extra lecture** | Same-course same-day lecture | When two lectures of the exact same course are placed on the same day for a group. |
| **S5** | **1 per session** | Room under-utilisation (<40%) | When room capacity is significantly oversized ($s.enrolled\_count < 0.40 \times s.room.capacity$). |
| **S6** | **1 per session** | Period P9 usage | Discourages scheduling classes into late period P9 (17:00–18:00). |
| **S-Exam**| **5 per extra exam** | Multiple exams per group per day | Penalises placing more than 1 exam for the same student group on the same day. |

---

## 3. Definition of "Moved" Session (Rescheduling - 15 Marks)

In Phase 3 Rescheduling evaluation, the validator measures the number of moved sessions between `baseline` and `schedule_after`:

$$\text{is\_moved}(s) \iff (s.day \neq baseline[s].day) \lor (s.start\_period \neq baseline[s].start_period) \lor (s.room \neq baseline[s].room)$$

### Critical Observations:
1. **Room-Only Change Counts as Moved:** If a session stays at the same day and time but changes room, it **counts as a moved session**.
2. **Time-Only Change Counts as Moved:** Day or start period change counts as moved.
3. **New/Added Sessions Do NOT Count:** Newly added sessions resulting from disruptions do not count towards the "moved" metric.
4. **Lexicographic Solver Objective:**
   - Priority 1: Zero hard violations (feasibility).
   - Priority 2: Minimise count of moved sessions ($M$).
   - Priority 3: Minimise total soft penalty.
   - Formally: $\text{Objective} = 10000 \times M + \text{SoftScore}$.

---

## 4. Booking Decisions & Score Formula (10 Marks)

The booking engine is 100% deterministic, resolving venue requests by institutional priority:

### Priority Hierarchy & Weights:
| Category | Priority Rank | Weight | Description |
|----------|---------------|--------|-------------|
| **Exams** | Priority 1 | - | Midsem / Endsem examinations |
| **Regular Classes** | Priority 2 | - | Mandatory academic timetable |
| **Institute Events** | Priority 3 | 5 points | Convocation, Foundation Day, Annual Day |
| **Guest Lectures** | Priority 4 | 4 points | Eminent speaker talks, workshops |
| **Department Events** | Priority 5 | 3 points | Department seminars, hackathons, lab meets |
| **Club Events** | Priority 6 | 2 points | Spectra cultural & tech club events |

### Booking Score Calculation:
- **Role Category Cap:** Effective category is capped at the user's role authorization:
  $$\text{effective\_category} = \min(\text{requested\_category}, \text{role\_category\_cap})$$
  *(Prevents privilege escalation; club reps cannot request as institute event).*
- **Scoring Multipliers:**
  - `approved` = $1.0 \times \text{weight}$ (Full points)
  - `alternative_offered` = $0.5 \times \text{weight}$ (Half points)
  - `rejected` = $0.0$ points
- **Maximum Possible Score:** **70 points** (out of 25 Spectra requests; BR-04 is explicitly cancelled).

### Export Status Requirements:
- Statuses in `schedule.json` MUST be strictly one of: `approved`, `rejected`, `alternative_offered`.
- Approved bookings must sit **fully inside** their requested time window and end by **P13** ($\le 13$).
- Preemption / Overrides: ONLY allowed for approved Institute Events (Priority 3) bumping lower events or classes with admin approval.
- Room Selection: The request's `requested_room` is treated only as a preference. Engine checks valid rooms matching `room_types`, `capacity`, `needs`, and `accessible`. A request is rejected **only** if no valid room/slot exists.

---

## 5. Midsem Exam Scheduling Rules

- **Exam Week:** Scheduled across the dedicated 5-day examination week.
- **Capacity Halving Rule:** To maintain anti-cheating separation:
  $$\text{effective\_capacity} = \lfloor \text{room.capacity} / 2 \rfloor$$
- **Multi-Room Splitting:** If course enrollment exceeds a single room's halved capacity, the exam can span multiple adjacent rooms.
- **One Exam Per Group Per Day:** Enforced by soft penalty (5 per violation); optimal schedule achieves strictly $\le 1$ exam per student group per day.
- **Clash Freedom:** No student group, invigilator, or room may overlap across exam slots.

---

## 6. Joint Timetable & Booking Execution Plan

To maximize the booking score (target 70) while preserving 0 hard timetable violations:
1. **Pre-Solve Spectra Booking Allocations:**
   - Auditorium reservations during non-teaching or held windows.
   - ECE-3 Thursday P8 and one P9.
   - CE-3 3-hour dedicated block.
   - At least one Computer Science lab kept free from P8 onwards on Thursday & Friday.
2. **Anchor Placements:**
   - Anchor session `ID101` in Auditorium on Wednesday P3.
3. **Hard Reservation Injection:** Pass the above reservations into CP-SAT as blocked room-time intervals before solving the weekly timetable. Relax reservations only if CP-SAT proves infeasibility.

---

## 7. Official `schedule.json` Export Specification

`validator.py` expects the following exact top-level JSON structure:

```json
{
  "metadata": {
    "generated_at": "2026-10-31T15:55:00Z",
    "solver_status": "OPTIMAL",
    "hard_violations": 0,
    "soft_penalty": 42,
    "moved_sessions_count": 0
  },
  "timetable": [
    {
      "session_id": "CS101-L1",
      "course_code": "CS101",
      "session_type": "lecture",
      "group_id": "G-CS-1",
      "faculty_id": "FAC-01",
      "room_id": "CR-101",
      "day": "Monday",
      "start_period": 1,
      "duration": 1
    }
  ],
  "exams": [
    {
      "exam_id": "EX-CS101",
      "course_code": "CS101",
      "group_id": "G-CS-1",
      "room_ids": ["CR-101", "CR-102"],
      "invigilator_id": "FAC-05",
      "day": "Monday",
      "period": 2,
      "enrolled": 45
    }
  ],
  "bookings": [
    {
      "request_id": "BR-01",
      "title": "Robotics Workshop",
      "category": "club",
      "status": "approved",
      "assigned_room": "AUD",
      "assigned_day": "Friday",
      "start_period": 10,
      "end_period": 12,
      "reason": "Approved: Auditorium available for requested window P10-P12.",
      "alternatives": []
    }
  ]
}
```

---

## 8. Python Validator Execution Method

Official validator interface:
```python
from data.validator import run

# Run signature:
# run(data: dict, sched: dict, baseline: dict | None = None) -> dict
results = run(cit_data, schedule_json, baseline_schedule)
# Returns:
# {
#   "hard_violations": [...],
#   "hard_count": 0,
#   "soft_penalty": 38,
#   "soft_breakdown": {...},
#   "moved_sessions": 0,
#   "booking_score": 70.0,
#   "booking_breakdown": {...}
# }
```
