from pydantic import BaseModel, ConfigDict, Field


class ProjectResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_uuid: str = Field(alias="projectUuid")
    name: str
    warehouse_type: str = Field(alias="warehouseType")
    warehouse_uuid: str | None = Field(default=None, alias="warehouseUuid")
    warehouse_name: str | None = Field(default=None, alias="warehouseName")
    created_by_user_uuid: str = Field(alias="createdByUserUuid")
    created_at: str = Field(alias="createdAt")


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    warehouse_uuid: str | None = Field(default=None, alias="warehouseUuid")
