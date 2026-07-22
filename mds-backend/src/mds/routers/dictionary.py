from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from mds.api.envelope import ok
from mds.db.session import get_db
from mds.schemas.dictionary import DictionaryColumnUpdate, DictionaryModelUpdate
from mds.services import dictionary as dictionary_service

router = APIRouter(prefix="/projects/{project_uuid}/dictionary", tags=["dictionary"])


@router.get("")
def list_dictionary(project_uuid: str, db: Session = Depends(get_db)):
    return ok(dictionary_service.list_dictionary(db, project_uuid))


@router.get("/quality")
def dictionary_quality(project_uuid: str, db: Session = Depends(get_db)):
    return ok(dictionary_service.dictionary_quality(db, project_uuid))


@router.get("/{unique_id:path}")
def get_dictionary_entry(
    project_uuid: str,
    unique_id: str,
    db: Session = Depends(get_db),
):
    return ok(dictionary_service.get_dictionary_entry(db, project_uuid, unique_id))


@router.put("/{unique_id:path}/columns/{column_name}")
def update_dictionary_column(
    project_uuid: str,
    unique_id: str,
    column_name: str,
    body: DictionaryColumnUpdate,
    db: Session = Depends(get_db),
):
    return ok(
        dictionary_service.update_dictionary_column(
            db, project_uuid, unique_id, column_name, body
        )
    )


@router.put("/{unique_id:path}")
def update_dictionary_model(
    project_uuid: str,
    unique_id: str,
    body: DictionaryModelUpdate,
    db: Session = Depends(get_db),
):
    return ok(
        dictionary_service.update_dictionary_model(db, project_uuid, unique_id, body)
    )
