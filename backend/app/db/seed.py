"""Seed the database with demo accounts and default data."""

from backend.app.db.session import init_db, get_engine, get_session_factory
from backend.app.db.models import User
from backend.app.core.security import hash_password
from backend.app.core.logging import get_logger

logger = get_logger("seed")

DEMO_USERS = [
    {
        "username": "admin",
        "display_name": "Dr. Rajesh Kumar (Admin)",
        "password": "admin123",
        "role": "admin",
        "department": None,
    },
    {
        "username": "coordinator",
        "display_name": "Prof. Anita Sharma (Dept Coordinator)",
        "password": "coord123",
        "role": "coordinator",
        "department": "Computer Science",
    },
    {
        "username": "faculty",
        "display_name": "Dr. Suresh Patel (Faculty)",
        "password": "faculty123",
        "role": "faculty",
        "department": "Computer Science",
    },
    {
        "username": "clubrep",
        "display_name": "Priya Nair (Club Representative)",
        "password": "clubrep123",
        "role": "club_rep",
        "department": None,
    },
]


def seed_users() -> None:
    """Create demo accounts if they don't exist."""
    init_db()
    SessionLocal = get_session_factory()
    db = SessionLocal()
    try:
        for user_data in DEMO_USERS:
            existing = db.query(User).filter_by(username=user_data["username"]).first()
            if existing is None:
                user = User(
                    username=user_data["username"],
                    display_name=user_data["display_name"],
                    hashed_password=hash_password(user_data["password"]),
                    role=user_data["role"],
                    department=user_data["department"],
                )
                db.add(user)
                logger.info(f"Seeded user: {user_data['username']} ({user_data['role']})")
            else:
                logger.info(f"User already exists: {user_data['username']}")
        db.commit()
        logger.info("Seeding complete.")
    finally:
        db.close()


def reset_db() -> None:
    """Drop and recreate all tables, then re-seed."""
    from backend.app.db.models import Base
    engine = get_engine()
    Base.metadata.drop_all(bind=engine)
    logger.info("All tables dropped.")
    seed_users()


if __name__ == "__main__":
    from backend.app.core.logging import setup_logging
    setup_logging()
    seed_users()

