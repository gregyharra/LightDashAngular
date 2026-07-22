from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DictionaryModelUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    description_override: str | None = Field(default=None, alias="descriptionOverride")
    tags: list[str] | None = None
    custom: dict[str, Any] | None = None


class DictionaryColumnUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    description_override: str | None = Field(default=None, alias="descriptionOverride")
    tags: list[str] | None = None
    custom: dict[str, Any] | None = None
