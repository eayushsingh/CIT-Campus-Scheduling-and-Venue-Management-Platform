# CIT Dataset Sanity Report (`cit_public.json`)

> Generated during Phase 1 Data Ingestion & Model Normalisation.
> Evaluated against `/data/cit_public.json` dataset `cit-public-v1`.

---

## 1. Executive Summary: Entity Counts Verification

All entity counts strictly match the hackathon ground truth:

| Entity Type | Required Count | Actual Dataset Count | Status | Notes / Breakdown |
|---|---|---|---|---|
| **Rooms** | **27** | **27** | ✅ PASS | 1 Auditorium (AUD), 6 Lecture Halls (LH-1..6), 9 Classrooms (CR-101..303), 2 Seminar Halls (SH-1, SH-2), 1 Outdoor (OAT), 7 Specialized Labs/Workshops. |
| **Faculty** | **40** | **40** | ✅ PASS | Faculty F01 through F40 across CSE, ECE, ME, CE, EE, BS, HSS departments. Daily teaching hours limit $\le 4$h. |
| **Student Groups** | **14** | **14** | ✅ PASS | Key: `student_groups`. Year 1: Y1-A, Y1-B, Y1-C, Y1-D. Year 2: CS-2, EC-2, ME-2, CE-2, EE-2. Year 3: CS-3, EC-3, ME-3, CE-3, EE-3. |
| **Courses** | **62** | **62** | ✅ PASS | Across 5 departments. Includes open elective basket courses OE301, OE302, OE303. |
| **Sessions** | **189** | **189** | ✅ PASS | Sum of teaching durations = **243 teaching hours**. 162 1-hour lectures/tutorials + 27 3-hour lab blocks (27 $\times$ 3 = 81 hours; 162 + 81 = 243). |
| **Booking Requests** | **25** | **25** | ✅ PASS | Requests BR-01 through BR-25 for Spectra Week 7. **BR-04 is explicitly cancelled** in `cancellations`. |
| **Midsem Exams** | **41** | **41** | ✅ PASS | Covering all course examinations across Year 1, Year 2, and Year 3. |

---

## 2. Room Breakdown & Capabilities

| Room ID | Name | Type | Capacity | Halved Exam Cap | Allowed Uses | Features | Accessible |
|---|---|---|---|---|---|---|---|
| **AUD** | Main Auditorium | auditorium | 500 | 250 | lecture, tutorial, exam, event | projector, pa_system, stage, ac | Yes |
| **LH-1** | Lecture Hall 1 | lecture_hall | 200 | 100 | lecture, tutorial, exam, event | projector, pa_system, ac | Yes |
| **LH-2** | Lecture Hall 2 | lecture_hall | 200 | 100 | lecture, tutorial, exam, event | projector, pa_system, ac | Yes |
| **LH-3** | Lecture Hall 3 | lecture_hall | 120 | 60 | lecture, tutorial, exam, event | projector, pa_system | Yes |
| **LH-4** | Lecture Hall 4 | lecture_hall | 120 | 60 | lecture, tutorial, exam, event | projector, pa_system | Yes |
| **LH-5** | Lecture Hall 5 | lecture_hall | 120 | 60 | lecture, tutorial, exam, event | projector, pa_system | Yes |
| **LH-6** | Lecture Hall 6 | lecture_hall | 120 | 60 | lecture, tutorial, exam, event | projector, pa_system | Yes |
| **CR-101..103** | Classrooms 101-103 | classroom | 60 | 30 | lecture, tutorial, exam, event | projector | Yes (Ground floor) |
| **CR-201..203** | Classrooms 201-203 | classroom | 60 | 30 | lecture, tutorial, exam, event | projector | **No (Floor 2)** |
| **CR-301..303** | Classrooms 301-303 | classroom | 60 | 30 | lecture, tutorial, exam, event | projector | **No (Floor 3)** |
| **SH-1** | Seminar Hall 1 | seminar_hall | 150 | 75 | event | projector, pa_system, stage, ac | Yes |
| **SH-2** | Seminar Hall 2 | seminar_hall | 80 | 40 | event | projector, pa_system | **No** |
| **OAT** | Open Air Theatre | outdoor | 800 | 0 | event | stage, pa_system | Yes |
| **CS-LAB-1** | Computer Lab 1 | lab_cs | 45 | 0 | lab | computers, projector, ac | Yes |
| **CS-LAB-2** | Computer Lab 2 | lab_cs | 45 | 0 | lab | computers, projector, ac | Yes |
| **CS-LAB-3** | Computer Lab 3 | lab_cs | 45 | 0 | lab | computers, projector, ac | Yes |
| **EE-LAB** | Electrical Lab | lab_elec | 45 | 0 | lab | lab_equipment | Yes |
| **PHY-LAB** | Physics Lab | lab_phy | 45 | 0 | lab | lab_equipment | Yes |
| **ME-WS** | Central Workshop | workshop | 45 | 0 | lab | heavy_machinery | Yes |
| **CE-LAB** | Civil Structures Lab | lab_civil | 45 | 0 | lab | testing_rigs | Yes |

### Key Room Invariants:
1. **Accessibility Boundary:** Classrooms `CR-201..203`, `CR-301..303`, and `SH-2` are **NOT wheelchair accessible**. Student groups or sessions with `needs_accessible: true` (e.g. ME-2 group) are strictly forbidden from these rooms (enforced by H10).
2. **Teaching Allowed Uses:** Seminar Halls (`SH-1`, `SH-2`) and `OAT` do not include `lecture` or `tutorial` in `allowed_uses` $\implies$ regular teaching sessions cannot be placed here.
3. **Exam Allowed Uses:** Labs (`CS-LAB-1..3`, `EE-LAB`, `PHY-LAB`, `ME-WS`, `CE-LAB`) and `OAT` do not allow exams $\implies$ only `AUD`, `LH-1..6`, and `CR-101..303` can host midsem exams (enforced by E2).

---

## 3. Maintenance & Unavailability Constraints

### Room Unavailability:
- `LH-4`: Closed all day Thursday (`THU`, P1..P9) for HVAC overhaul.
- `CR-103`: Closed Friday afternoon (`FRI`, P6..P9) for smart-board maintenance.

### Critical Faculty Availability Windows:
- `F08` (Adjunct Professor): On campus **Tue/Thu only** (`MON`, `WED`, `FRI` unavailable).
- `F37` (Dean): Available for teaching **strictly Mon/Wed/Fri P3..P5** (all other times blocked by administrative duties).
- `F21`: Unavailable all Friday (`FRI` P1..P9).

---

## 4. Elective Baskets & Combined Sessions

1. **Combined Lectures:**
   - `ID101-ALL-L1` (Introduction to Design): Enrolls all Year 1 sections (Y1-A, Y1-B, Y1-C, Y1-D), total size = **360 students**.
   - **Only AUD (capacity 500)** can physically accommodate this session.
2. **Open Elective Baskets (Year 3):**
   - Three basket slots: `OEB-1`, `OEB-2`, `OEB-3`.
   - Each basket contains sessions for `OE301`, `OE302`, `OE303` running in parallel at the same day and period.
   - Enrolled groups: All Year 3 groups (`CS-3`, `EC-3`, `ME-3`, `CE-3`, `EE-3`).

---

## 5. Booking Requests (Spectra Fest Week 7)

- **Total Requests:** 25 requests (`BR-01` to `BR-25`).
- **Cancelled:** `BR-04` (Robotics Workshop) was withdrawn; must be excluded from scheduling and scoring.
- **Impossible Capacity:** `BR-09` requests attendance 1,200 (largest campus venue OAT seats 800) $\implies$ must be deterministically rejected with clear reason.
- **Invalid Window:** `BR-17` requested window is P13..P14 (P14 does not exist) $\implies$ cannot be approved inside requested window; engine must offer `alternative_offered`.
- **Max Theoretical Score:** 70; **Realistic Score Ceiling:** $\approx 67.0$.

