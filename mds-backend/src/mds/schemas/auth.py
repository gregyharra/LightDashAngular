from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class SetupRequest(BaseModel):
    email: str
    first_name: str = Field(alias="firstName")
    last_name: str = Field(alias="lastName")
    password: str

    model_config = {"populate_by_name": True}


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(alias="currentPassword")
    new_password: str = Field(alias="newPassword")

    model_config = {"populate_by_name": True}


class ResetPasswordRequest(BaseModel):
    """Redeem a one-time reset token, or set a new password when must_change_password."""

    new_password: str = Field(alias="newPassword")
    token: Optional[str] = None

    model_config = {"populate_by_name": True}


class UserCreateRequest(BaseModel):
    email: str
    first_name: str = Field(alias="firstName")
    last_name: str = Field(alias="lastName")
    password: Optional[str] = None
    role: Literal["admin", "member"] = "member"

    model_config = {"populate_by_name": True}


class UserUpdateRequest(BaseModel):
    first_name: Optional[str] = Field(default=None, alias="firstName")
    last_name: Optional[str] = Field(default=None, alias="lastName")
    role: Optional[Literal["admin", "member"]] = None
    is_active: Optional[bool] = Field(default=None, alias="isActive")
    password: Optional[str] = None
    reset_password: bool = Field(default=False, alias="resetPassword")

    model_config = {"populate_by_name": True}
