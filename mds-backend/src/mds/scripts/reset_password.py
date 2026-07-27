"""Reset a user's password from the server (admin lockout escape hatch).

Usage:
  cd mds-backend
  python -m mds.scripts.reset_password --email admin@example.com --password 'new-secure-password'
"""

from __future__ import annotations

import argparse
import sys

from mds.db.models import User
from mds.db.session import SessionLocal, init_db
from mds.services.auth.passwords import MIN_PASSWORD_LENGTH, set_user_password


def reset_password(email: str, password: str) -> None:
    init_db()
    db = SessionLocal()
    try:
        normalized = email.strip().lower()
        user = db.query(User).filter(User.email == normalized).one_or_none()
        if user is None:
            raise SystemExit(f"No user found with email: {normalized}")
        set_user_password(db, user, password)
        db.commit()
        print(f"Password reset for {normalized}")
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Reset a user password by email")
    parser.add_argument("--email", required=True, help="User email address")
    parser.add_argument(
        "--password",
        required=True,
        help=f"New password (min {MIN_PASSWORD_LENGTH} characters)",
    )
    args = parser.parse_args(argv)
    try:
        reset_password(args.email, args.password)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
