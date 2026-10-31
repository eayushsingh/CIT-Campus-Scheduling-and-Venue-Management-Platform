"""CIT Platform Command Line Interface.

Usage:
  python -m app.cli export [--target exports/schedule.json]
  python -m app.cli validate [--schedule exports/schedule.json]
  python -m app.cli seed
"""

import sys
import argparse
from pathlib import Path

# Add backend directory to sys.path so 'app' imports work
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from backend.app.services.schedule_service import generate_full_schedule, export_schedule_to_file
from backend.app.data.loader import load_raw_dataset
from backend.app.validation.official_validator import run_official_validator
from backend.app.core.logging import setup_logging, get_logger

logger = get_logger("cli")


def main():
    setup_logging(debug=False)
    parser = argparse.ArgumentParser(description="CIT Scheduling Platform CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # export command
    export_parser = subparsers.add_parser("export", help="Generate and export validated schedule.json")
    export_parser.add_argument("--target", default="exports/schedule.json", help="Destination file path")
    export_parser.add_argument("--time-limit", type=int, default=30, help="Solver time limit in seconds")

    # validate command
    val_parser = subparsers.add_parser("validate", help="Validate an existing schedule file against cit_public.json")
    val_parser.add_argument("--schedule", default="exports/schedule.json", help="Path to schedule.json")
    val_parser.add_argument("--baseline", help="Optional baseline schedule for rescheduling check")

    # seed command
    subparsers.add_parser("seed", help="Seed database with demo users")

    args = parser.parse_args()

    if args.command == "export":
        print(f"Generating full schedule (solver time limit: {args.time_limit}s)...")
        schedule, report = generate_full_schedule(time_limit_seconds=args.time_limit)
        target = export_schedule_to_file(args.target)
        print(f"SUCCESS: Exported validated schedule to {target}")
        print(f"Hard violations: {report.get('hard_count', 0)}")
        print(f"Soft total: {report.get('soft_total', 0)}")
        print(f"Booking score: {report.get('bookings', {}).get('booking_score', 0)}")

    elif args.command == "validate":
        import json
        raw_data = load_raw_dataset()
        with open(args.schedule, "r", encoding="utf-8") as f:
            sched = json.load(f)
        base = None
        if args.baseline:
            with open(args.baseline, "r", encoding="utf-8") as f:
                base = json.load(f)

        report = run_official_validator(raw_data, sched, baseline=base)
        print(f"Dataset ID: {report.get('dataset_id')}")
        print(f"Hard violations: {report.get('hard_count', 0)} {report.get('hard_by_rule', {})}")
        print(f"Soft penalty: {report.get('soft_total', 0)}")
        if "bookings" in report:
            b = report["bookings"]
            print(f"Booking score: {b.get('booking_score')} | Approved: {b.get('approved')}, "
                  f"Alternatives: {b.get('alternatives')}, Rejected: {b.get('rejected')}")
        if report.get("hard_count", 0) > 0:
            sys.exit(1)

    elif args.command == "seed":
        from backend.app.db.seed import seed_users
        seed_users()
        print("Demo users seeded successfully.")


if __name__ == "__main__":
    main()

