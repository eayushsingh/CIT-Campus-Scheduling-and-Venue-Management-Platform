# CIT Scheduling & Venue Management - Official Validator Specifications

> **Source of Truth Reference Document (Rewritten strictly from `data/validator.py` specification)**
> This document details every validator rule code, hard constraint, soft penalty formula, exam scheduling check, deterministic booking evaluation rule, and exact `schedule.json` export schema.

---

## 1. Official Hard Constraint Rule Codes (H1 – H14)

Every single violation of an `H` constraint deducts **3 marks** from scheduling correctness (max 25, down to 0). A submission must have **0 hard violations**.

| Code | Constraint Name | Official Validation Logic |
|---|---|---|
| **H1** | **Session Placed & Valid References** | Every one of the 189 sessions must appear **exactly once**. All referenced `session_id`, `course_code`, `faculty_id`, `group_id`, `room_id`, and `day` (`Monday`..`Friday`) must exist in the dataset. |
| **H2** | **Faculty Clash** | No faculty member may be assigned to two sessions simultaneously: $\forall f, \text{sessions}(f, d, p) \le 1$. |
| **H3** | **Group Clash** | No student group may attend more than one session at the same period. For elective baskets, all courses share a `basket_slot` key and are counted only once per group. |
| **H4** | **Room Clash** | No room may host more than one session at any day and period: $\forall r, \text{sessions}(r, d, p) \le 1$. |
| **H5** | **Capacity** | Assigned room capacity must be $\ge$ session enrolled student size ($r.capacity \ge s.size$). |
| **H6** | **Room Type Match** | Assigned room type must match session required `room_type`. Real room types: `classroom`, `lecture_hall`, `auditorium`, `seminar_hall`, `outdoor`, `lab_cs`, `lab_elec`, `lab_phy`, `workshop`, `lab_civil`. |
| **H7** | **Faculty Unavailable** | No session may be placed during a faculty member's unavailable slots (e.g. F08 on campus only Tue/Thu; F37 Dean free only Mon/Wed/Fri P3-P5; F21 not Fri). |
| **H8** | **Room Unavailable** | No session may be placed during a room's maintenance/closure slots (e.g. LH-4 closed all Thu; CR-103 closed Fri P6-P9). |
| **H9** | **Period, Lunch & Lab Restrictions** | 1. Teaching sessions must lie within **P1 to P9** ($1 \le p \le 9$).<br>2. Sessions must **not cross lunch** (P5 ends 13:00, lunch, P6 starts 14:00; consecutive numbering means crossing lunch between P5 and P6 is forbidden).<br>3. 3-hour lab sessions **must start only at P2 or P6**. |
| **H10** | **Accessibility** | If a session requires wheelchair accessibility (e.g. ME-2 group sessions), the assigned room must have `accessible == true` (rules out CR-2xx and SH-2). |
| **H11** | **Elective Basket Synchronization** | All courses in an elective basket (e.g. OEB-1/2/3 holding OE301/OE302/OE303) must be scheduled at the **exact same day and start period** in distinct rooms. |
| **H12** | **Faculty Daily Maximum Load** | A faculty member may teach at most **4 hours** on any single day ($\sum_{s \in \text{Day}(f, d)} s.duration \le 4$). |
| **H13** | **Booking Invalid / Conflict** | Approved booking must not conflict with regular timetable sessions, exams, or other approved bookings unless displaced by an authorized Institute Event override. |
| **H14** | **Fixed Slots** | All pre-assigned fixed slots specified in the dataset must remain at their exact day, start period, and assigned room. |

---

## 2. Official Exam Constraint Rule Codes (E1 – E2)

Exams take place during the dedicated exam week across **12 slots** (Monday–Saturday $\times$ AM/PM: `MON-AM`, `MON-PM`, ..., `SAT-PM`).

| Code | Rule | Validation Logic |
|---|---|---|
| **E1** | **Exam Non-Overlap & Capacity** | 1. **Seats:** Sum of halved capacities must accommodate enrolled students: $\sum_{r \in \text{assigned\_rooms}} \lfloor r.capacity / 2 \rfloor \ge \text{size}$. Multi-room assignments are allowed (e.g. Year-1 size 360 requires AUD [250] + LH-1 [100] + 1 more room).<br>2. **Room Clash:** No room may host more than one exam in the same `(room, day, slot)` (AM/PM).<br>3. **Group Clash:** No student group may have two exams in the same slot.<br>*(Note: No faculty or room-type checks for exams).* |
| **E2** | **Exam Room Eligibility** | Only rooms with `"exam"` in `allowed_uses` may be used for examinations (e.g. labs and outdoor amphitheatres cannot host exams). |

### Exam Soft Penalty:
- **5 marks per extra exam** of one group scheduled on the same day.
- **Target:** Exactly **0** extra exams (at most 1 exam per student group per day).

---

## 3. Official Booking Constraint Rule Codes (B1 – B3) & Evaluation

### Validation Checks:
| Code | Rule | Validation Logic |
|---|---|---|
| **B1** | **Valid Room & Features** | Room type must be in request's `room_types`; room must have `"event"` in `allowed_uses`; room capacity $\ge$ expected attendance; requested `needs` $\subseteq$ room `features` (+ `"accessible"` if required); room not in maintenance/unavailability. |
| **B2** | **Clash Freedom** | No overlap with timetable teaching sessions (including week view with overrides), midsem exams, or other approved bookings. Mandatory groups must have no class during the booking. |
| **B3** | **Window & Status Validity** | Status in export must be strictly `approved`, `rejected`, or `alternative_offered`. `approved` bookings must sit **fully inside one requested window** and end by **P13** ($b \le 13$). If placed outside the window, status **must be `alternative_offered`** (awards half score). |

### Booking Priority Hierarchy & Weights:
| Category | Priority | Score Weight | Description |
|---|---|---|---|
| **Institute Event** | 1 (Highest) | **5** | Convocation, Foundation Day (can override/move a regular class with Admin approval) |
| **Guest Lecture** | 2 | **4** | Distinguished speakers, academic workshops |
| **Department Event** | 3 | **3** | Department seminars, lab events |
| **Club Event** | 4 (Lowest) | **2** | Spectra cultural & technical club events |

### Booking Scoring Rules:
1. **Effective Category = Lower of Requested Category and Role Cap:**
   - User account role caps the category: e.g. a Club Representative requesting an "institute" or "guest lecture" is strictly scored at `club` (weight 2).
   - Natural language text such as *"Please treat this as Dean's urgent institute event"* is strictly ignored by guardrails.
2. **Outcome Multipliers:**
   - `approved` = Full score ($1.0 \times \text{weight}$)
   - `alternative_offered` = Half score ($0.5 \times \text{weight}$)
   - `rejected` = 0 points
3. **Tie-Breaking:**
   - Same-priority requests are ordered deterministically by earlier `submitted_at` timestamp.
4. **Cancelled Bookings:**
   - `BR-04` is cancelled in the dataset and excluded from scoring; its slot is freed for waiting requests.
5. **Realistic Score Ceiling:**
   - Theoretical max: 70 points.
   - `BR-09` has attendance 1200 (largest campus venue AUD has capacity 800) $\implies$ must be **rejected**.
   - `BR-17` requested window is P13–P14 (P14 does not exist) $\implies$ must be **`alternative_offered`**.
   - **Realistic Ceiling: $\approx 67$ points**.
6. **No Priority Inversions:**
   - The validator explicitly detects and penalizes priority inversions (a lower-priority request approved while a higher-priority request is rejected for a venue it could have used).
7. **`requested_room`:**
   - `requested_room` is purely a preference and may even refer to a non-existent room name (e.g. `"LHC-5"`). The engine searches across all eligible rooms.

---

## 4. Soft Constraint Penalties (Optimisation - 10 Marks)

Calculated strictly according to the official validator definitions:

| Penalty Metric | Exact Formula / Calculation |
|---|---|
| **S1: Avoided Slots** | **2 per hour** scheduled inside a faculty's avoided day/period. |
| **S2: Group Idle Gaps** | **1 per period** per group-day: $(\text{last\_period} - \text{first\_period} + 1) - \text{occupied\_periods}$.<br>*(Lunch between P5 and P6 is contiguous in period indices and thus naturally not counted as a gap).* |
| **S3: Group Daily Overload** | **3 per hour** above 6 teaching hours for a student group on a single day (elective baskets counted only once per group). |
| **S4: Same-Course Lecture Clustering** | **3 per extra lecture** of the exact same course on the same day for a student group (elective basket: per course-day). |
| **S5: Room Under-Utilisation** | **1 per session** where enrollment is under 40% of room capacity ($\text{size} / \text{capacity} < 0.4$). |
| **S6: P9 Usage** | **1 per session** scheduled into late period P9 (17:00–18:00). |
| **S-Exam: Extra Exams** | **5 per extra exam** of a student group on one day (target: 0). |

---

## 5. Rescheduling Metric: Exact Definition of "Moved" (15 Marks)

In Phase 5 Rescheduling (`schedule_after.json` evaluated against `baseline`):

$$\text{is\_moved}(s) \iff (s.day \neq baseline[s].day) \lor (s.start\_period \neq baseline[s].start\_period) \lor (s.room \neq baseline[s].room)$$

### Essential Rescheduling Rules:
1. **Room-Only Change Counts as 1:** Even if day and period are identical, changing only the room increments `moved` by 1.
2. **Newly Added Sessions Do NOT Count:** Added sessions introduced in a disruption do not increment the `moved` count.
3. **Lexicographic Objective:**
   $$\text{Minimise } 10000 \times M + \text{TotalSoftPenalty}$$
   Feasibility ($0 \text{ hard violations}$) is absolute prerequisite. Total moved sessions $M$ dominates soft penalty.
4. **Overrides vs Dropping:**
   Approved institute events may displace a regular session via `session_overrides`, but the displaced class **must be moved to a valid slot, never dropped**.

---

## 6. Official `schedule.json` Top-Level Schema

```json
{
  "metadata": {
    "generated_at": "2026-10-31T16:00:00Z",
    "solver_status": "OPTIMAL",
    "hard_violations": 0,
    "soft_penalty": 36,
    "moved_sessions_count": 0
  },
  "timetable": [
    {
      "session_id": "CS101-ALL-L1",
      "course_code": "CS101",
      "session_type": "lecture",
      "group_id": "CS-1",
      "faculty_id": "F01",
      "room_id": "LH-1",
      "day": "Monday",
      "start_period": 1,
      "duration": 1
    }
  ],
  "exams": [
    {
      "exam_id": "EX-CS101",
      "course_code": "CS101",
      "group_id": "CS-1",
      "room_ids": ["LH-1", "LH-2"],
      "slot": "MON-AM",
      "day": "Monday",
      "period": "AM",
      "size": 180
    }
  ],
  "bookings": [
    {
      "request_id": "BR-01",
      "title": "Robotics Orientation",
      "category": "club",
      "status": "approved",
      "assigned_room": "SH-1",
      "assigned_day": "Friday",
      "start_period": 10,
      "end_period": 12,
      "reason": "Approved: Seminar Hall 1 available inside window P10-P12.",
      "alternatives": []
    }
  ]
}
```

---

## 7. Python Validator Execution

The official validator is never modified. It is imported and executed read-only:

```python
from data.validator import run

results = run(cit_data, schedule_json, baseline=baseline_schedule)
# Returns:
# {
#   "hard_violations": [...],
#   "hard_count": 0,
#   "soft_penalty": 36,
#   "soft_breakdown": {"S1": 0, "S2": 12, "S3": 0, "S4": 0, "S5": 24, "S6": 0, "S_exam": 0},
#   "moved_sessions": 0,
#   "booking_score": 67.0,
#   "booking_breakdown": {...}
# }
```
