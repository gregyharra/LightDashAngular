from cryptography.fernet import Fernet, InvalidToken

from mds.config import settings


def _get_fernet() -> Fernet:
    key = settings.effective_encryption_key
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_secret(value: str) -> str:
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    try:
        return _get_fernet().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt stored secret") from exc
