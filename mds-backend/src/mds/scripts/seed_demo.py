"""Populate the database with demo data."""

from mds.db.seed import seed_demo_data
from mds.db.session import SessionLocal, init_db


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()
    print("Demo data seeded successfully.")


if __name__ == "__main__":
    main()
