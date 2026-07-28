"""Reset a user's password from the server (admin lockout escape hatch).

Usage:
  cd mds-backend
  # Issue a one-time reset link (and temporary password):
  python -m mds.scripts.reset_password --email admin@example.com

  # Or set an explicit temporary password as well:
  python -m mds.scripts.reset_password --email admin@example.com --password 'temp-secure-password'
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from urllib.parse import quote

from mds.config import redact_database_url, settings
from mds.db.models import User
from mds.db.session import SessionLocal, init_db
from mds.services.auth.passwords import (
    MIN_PASSWORD_LENGTH,
    PASSWORD_ALPHABET as _PASSWORD_ALPHABET,
    generate_password,
    issue_password_reset_token,
    set_user_password,
)


@dataclass(frozen=True)
class PasswordResetResult:
    password: str
    token: str
    reset_url: str


def describe_database_url(url: str | None = None) -> str:
    """Return DATABASE_URL with password redacted (for CLI/operator messages)."""
    return redact_database_url(url or settings.database_url)


def build_reset_url(token: str, app_origin: str | None = None) -> str:
    base = (app_origin or settings.public_app_url).rstrip("/")
    return f"{base}/reset-password?token={quote(token, safe='')}"


def reset_password(email: str, password: str | None = None) -> PasswordResetResult:
    """Reset password for ``email`` and issue a one-time reset token."""
    plain = password if password is not None else generate_password()
    init_db()
    db = SessionLocal()
    try:
        normalized = email.strip().lower()
        user = db.query(User).filter(User.email == normalized).one_or_none()
        if user is None:
            raise SystemExit(f"No user found with email: {normalized}")
        set_user_password(db, user, plain, require_change=True)
        token = issue_password_reset_token(user)
        db.commit()
        return PasswordResetResult(
            password=plain,
            token=token,
            reset_url=build_reset_url(token),
        )
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Reset a user password by email. Issues a one-time reset URL "
            "(and a temporary password if --password is omitted)."
        )
    )
    parser.add_argument("--email", required=True, help="User email address")
    parser.add_argument(
        "--password",
        default=None,
        help=(
            f"Temporary password (min {MIN_PASSWORD_LENGTH} characters). "
            "If omitted, a random temporary password is generated and printed."
        ),
    )
    args = parser.parse_args(argv)
    try:
        result = reset_password(args.email, args.password)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    email = args.email.strip().lower()
    print(f"Password reset for {email}")
    print(f"Database: {describe_database_url()}")
    print(f"Reset URL: {result.reset_url}")
    print(f"Temporary password: {result.password}")
    print(
        "Open the reset URL to choose a new password (no login required), "
        "or sign in with the temporary password — you will be asked to set a new one."
    )
    print("Use the same DATABASE_URL as the running API (see mds-backend/.env).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
