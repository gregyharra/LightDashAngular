from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from mds.api.envelope import ok
from mds.db.session import get_db
from mds.schemas.model_join import ModelJoinCreate, ModelJoinUpdate
from mds.services import model_joins as model_joins_service

router = APIRouter(prefix="/projects/{project_uuid}/model-joins", tags=["model-joins"])


@router.get("")
def list_model_joins(
    project_uuid: str,
    sourceModelId: str | None = None,
    db: Session = Depends(get_db),
):
    return ok(
        model_joins_service.list_model_joins(
            db, project_uuid, source_model_id=sourceModelId
        )
    )


@router.post("")
def create_model_join(
    project_uuid: str,
    body: ModelJoinCreate,
    db: Session = Depends(get_db),
):
    return ok(model_joins_service.create_model_join(db, project_uuid, body))


@router.put("/{join_uuid}")
def update_model_join(
    project_uuid: str,
    join_uuid: str,
    body: ModelJoinUpdate,
    db: Session = Depends(get_db),
):
    return ok(model_joins_service.update_model_join(db, project_uuid, join_uuid, body))


@router.delete("/{join_uuid}")
def delete_model_join(
    project_uuid: str,
    join_uuid: str,
    db: Session = Depends(get_db),
):
    model_joins_service.delete_model_join(db, project_uuid, join_uuid)
    return ok({"deleted": True})
