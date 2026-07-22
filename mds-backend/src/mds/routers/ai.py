from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from mds.api.envelope import ok
from mds.db.session import get_db
from mds.schemas.ai import AiChatRequest
from mds.services import ai_assistant

router = APIRouter(prefix="/projects/{project_uuid}/ai", tags=["ai"])


@router.post("/chat")
def ai_chat(
    project_uuid: str,
    body: AiChatRequest,
    db: Session = Depends(get_db),
):
    return ok(ai_assistant.chat(db, project_uuid, body))
