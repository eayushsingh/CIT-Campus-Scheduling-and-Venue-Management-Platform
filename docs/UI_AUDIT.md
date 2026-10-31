# CIT Campus Scheduling Platform — Comprehensive UI Audit (Part A)

> **Audit Date:** 2026-10-31  
> **Methodology:** Automated headless Chromium screenshots via Playwright across all 4 institution roles (`admin`, `coordinator`, `faculty`, `clubrep`) at both mobile (`360x800`) and laptop (`1440x900`) viewports.  
> **Artifacts Directory:** `docs/screenshots/audit/` (60 full-page screenshots captured).

---

## 1. Executive Summary & Scoring Gap Analysis

While the functional engine, CP-SAT solvers, and official validator integration are working with 0 hard violations, the UI audit reveals several critical usability, responsiveness, and design-system gaps that must be resolved to secure the **20 marks** dedicated to **Usability (10)** and **UI & Design (10)**:

| Area | Current State | Audit Finding | Target State (Part B) |
|---|---|---|---|
| **Design Tokens** | Ad-hoc Tailwind utility classes scattered in components. | Inconsistent color shades, button radiuses, typography hierarchy. | Single unified design tokens file `frontend/src/styles/tokens.ts` imported everywhere. |
| **Mobile Timetable** | Desktop-oriented 9-period table squeezed into 360px. | Squeezed text, cell truncations, difficult touch interaction on phone. | Adaptive view: Day tabs (MON..FRI) with vertical card stream on phone ($\le 640\text{px}$), grid on laptop. |
| **Room Finder** | Embedded as Tab 1 inside `/bookings`. | Hard to discover; judge rubric requires top-level accessibility. | Dedicated top-level route `/rooms` in sidebar & drawer navigation. |
| **Role Dashboard** | Same dashboard view for all 4 roles. | No role-specific primary actions. | Role-tailored home screen with **3 big role-specific primary action cards** per role. |
| **Lunch & Lab Spans** | Unstyled lunch boundary; 3-hour lab spans not visually merged. | Hard to visually distinguish lunch gap; labs look like isolated 1-hr blocks. | Prominent visual lunch band between P5 and P6; 3-hour lab blocks merged with multi-slot span indicator. |
| **Timetable Explain** | Cell click shows basic tooltip. | No contextual infeasibility / reason explanation. | Cell click opens details drawer with full metadata and a prominent **"Explain Slot"** AI/deterministic reason button. |
| **Disruption Diff** | Static table with summary diff. | Lacks confirmation modal and live soft penalty before/after comparison. | Side-by-side slot diff, badges for "Time Changed" vs "Room Only", before/after soft penalty, confirm dialog. |
| **Booking Form** | Basic draft preview form. | No "Assumptions" box; no live validity re-check while editing. | Assumptions card highlighting guesses (e.g. *"kal = tomorrow = Thursday"*), live constraint check, cancel request button. |
| **Touch & A11y** | Some buttons $< 36\text{px}$ height; focus rings missing. | Fails WCAG AA minimum 44px touch target guidelines on phones. | Min 44px touch targets, visible focus rings, aria-labels, WCAG AA contrast. |
| **Admin Reset** | Only accessible on `/admin` page. | Judges testing disruption cannot reset from any screen. | Global bottom footer on every page with "Reset Demo State" button (Admin only). |

---

## 2. Page-by-Page Audit Findings

### A. Login Screen (`/login`)
- **Laptop (1440x900):** 
  - Clear split card between 1-click demo logins and manual credentials.
  - *Improvement:* Make credentials text even more legible and add 1-click role tags (`Admin`, `Coordinator`, `Faculty`, `Club Rep`) with distinctive color badges.
- **Mobile (360x800):** 
  - Stacks correctly, but demo buttons touch targets are slightly cramped ($38\text{px}$). 
  - *Fix:* Ensure minimum $48\text{px}$ touch targets and clear spacing.

### B. Dashboard (`/`)
- **Audit Findings:** 
  - Currently displays a static list of generic feature cards.
  - Does not highlight role-specific urgency (e.g. Admin needs to see pending disruptions and validator status; Faculty needs their teaching schedule; Club Rep needs their booking status).
- **Required Fixes:**
  - **3 Big Primary Actions per Role:**
    - **Admin:** `[Trigger Solver]`, `[Review Approvals]`, `[Validator Health]`
    - **Faculty:** `[My Teaching Timetable]`, `[Request Leave / Swap]`, `[Ask Assistant]`
    - **Coordinator:** `[Department Timetable]`, `[Dept Event Booking]`, `[Review Approvals]`
    - **Club Rep:** `[New Venue Booking]`, `[My Booking Status]`, `[Instant Room Finder]`
  - Add **Room Utilization Heatmap** (rooms $\times$ days) with occupancy tooltips.
  - Add KPI cards for: Pending Approvals count, Soft Penalty, Validator status (Green/Red badge).

### C. Timetable Grid (`/timetable`)
- **Laptop (1440x900):**
  - Grid needs visual color coding by session kind:
    - **Lecture:** Light blue border & fill
    - **Lab (3-hr):** Emerald green, visibly spanning 3 columns/rows
    - **Tutorial:** Amber / Orange fill
    - **Fixed Slots (e.g. ID101):** Purple fill
  - Add an on-screen **Color Legend** bar.
  - Add a clearly labeled vertical **Lunch Band** between P5 (13:00) and P6 (14:00).
  - Clicking any cell opens a **Slide-over Drawer** with full details + **"Explain This Slot"** button.
- **Mobile (360x800):**
  - **CRITICAL:** Do NOT squeeze a 9-period table onto a 360px screen!
  - Replace with **Day Tabs (`MON` | `TUE` | `WED` | `THU` | `FRI`)** and a clean vertical chronological timeline of sessions for that day.

### D. Top-Level Room Finder (`/rooms`)
- **Audit Findings:**
  - Previously buried as a tab inside `/bookings`.
- **Required Fixes:**
  - Move to a dedicated top-level route `/rooms` in sidebar & mobile drawer.
  - Form controls: Day, Period, Duration (1–4 hrs), Min Capacity, Room Type (`classroom`, `lecture_hall`, `auditorium`, `seminar_hall`, `lab_cs`, etc.), Wheelchair Accessibility filter.
  - Free rooms displayed in a responsive card grid with features (`Projector`, `AC`, `Audio`, `Floor`).
  - **"Best Fit" Badge:** Highlight the room whose capacity is closest $\ge$ attendance to avoid room under-utilization penalty (S5).

### E. Venue Bookings (`/bookings`)
- **Audit Findings:**
  - AI prompt parser output lacked visual transparency on what assumptions the parser made.
- **Required Fixes:**
  - Free-text box with interactive chips in English and Hinglish.
  - Parsed preview as an editable form with an explicit **"Assumptions & Inferences"** box (e.g., *"Parsed 'kal shaam 6 baje' as Thursday Period 10 (18:00 - 19:00)"*).
  - Live validity check indicator updating on every keystroke/change in the form.
  - Spectra bookings table with a **"Cancel Booking"** button for club reps to retract requests.

### F. Disruptions & Approvals (`/disruptions` & `/approvals`)
- **Audit Findings:**
  - Need clearer visual distinction between Time Changed vs Room Only moves.
  - Missing two-step confirmation dialog before applying live changes.
- **Required Fixes:**
  - Side-by-side slot diff: `Old Slot & Room` $\rightarrow$ `New Slot & Room`.
  - Color badges: `[Time & Room Changed]` (Amber), `[Room Only]` (Blue), `[New Added]` (Purple).
  - Prominent banner: *"Nothing is applied to the live timetable until an Administrator confirms."*
  - Approve & Reject actions with a clean confirmation modal.
  - Plain-language explanation for infeasible disruption proposals.

### G. System-Wide Feedback & States
- **Skeleton Loaders:** Replaces spinner jumps during data fetches to eliminate layout shift (CLS = 0).
- **Empty States:** Every empty list includes an informative icon, title, description, and an action button (e.g. *"Book your first venue"*).
- **Global Toast System:** Immediate visual feedback upon successful submission or approval.
- **Admin Footer:** Sticky bottom bar visible only to `admin` with a 1-click **"Reset Demo Data"** action.

---

## 3. Implementation Plan (Part B)

1. `frontend/src/styles/tokens.ts`: Centralized design token system (colors, typography, shadows, borders, radii).
2. `frontend/src/components/Layout.tsx`: Enhanced responsive layout with laptop sidebar, mobile top header + bottom drawer, and admin reset footer.
3. `frontend/src/pages/DashboardPage.tsx`: Role-specific hero actions, utilization heatmap, and live validator score card.
4. `frontend/src/pages/TimetablePage.tsx`: Color-coded session types, legend, lunch divider, 3-hour lab spans, mobile day-tab vertical timeline, and cell inspection slide-over drawer with AI "Why?" explanation.
5. `frontend/src/pages/RoomFinderPage.tsx`: Top-level route with best-fit badge and 1-click booking handoff.
6. `frontend/src/pages/BookingsPage.tsx`: Assumptions drawer, live validity preview, and cancel request action.
7. `frontend/src/pages/DisruptionsPage.tsx` & `ApprovalsPage.tsx`: Side-by-side diff view, confirmation modal, and plain-language infeasibility explainer.
