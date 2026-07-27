"""Reset a user's password from the server (admin lockout escape hatch).

Usage:
  cd mds-backend
  # Generate a random password and print it:
  python -m mds.scripts.reset_password --email admin@example.com

  # Or set an explicit password:
  python -m mds.scripts.reset_password --email admin@example.com --password 'new-secure-password'
"""

from __future__ import annotations

import argparse
import secrets
import string
import sys

from mds.db.models import User
from mds.db.session import SessionLocal, init_db
from mds.services.auth.passwords import MIN_PASSWORD_LENGTH, set_user_password

# Exclude ambiguous characters (0/O, 1/l/I) for easier copy from the terminal.
_PASSWORD_ALPHABET = string.ascii_letters + string.digits + "!@#$%^&*-_"
_GENERATED_PASSWORD_LENGTH = 20


def generate_password(length: int = _GENERATED_PASSWORD_LENGTH) -> str:
    if length < MIN_PASSWORD_LENGTH:
        length = MIN_PASSWORD_LENGTH
    return "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(length))


def reset_password(email: str, password: str | None = None) -> str:
    """Reset password for ``email``. Returns the plaintext password that was set."""
    plain = password if password is not None else generate_password()
    init_db()
    db = SessionLocal()
    try:
        normalized = email.strip().lower()
        user = db.query(User).filter(User.email == normalized).one_or_none()
        if user is None:
            raise SystemExit(f"No user found with email: {normalized}")
        set_user_password(db, user, plain)
        db.commit()
        return plain
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Reset a user password by email (generates one if --password is omitted)"
    )
    parser.add_argument("--email", required=True, help="User email address")
    parser.add_argument(
        "--password",
        default=None,
        help=(
            f"New password (min {MIN_PASSWORD_LENGTH} characters). "
            "If omitted, a random password is generated and printed."
        ),
    )
    args = parser.parse_args(argv)
    try:
        plain = reset_password(args.email, args.password)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    email = args.email.strip().lower()
    if args.password is None:
        print(f"Password reset for {email}")
        print(f"Temporary password: {plain}")
        print("Sign in with this password, then change it from the user menu.")
    else:
        print(f"Password reset for {email}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
