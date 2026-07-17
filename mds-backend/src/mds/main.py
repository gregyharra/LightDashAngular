from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from mds.api.envelope import http_exception_handler, validation_exception_handler
from mds.config import settings
from mds.db.seed import seed_demo_data
from mds.db.session import SessionLocal, init_db
from mds.routers.dashboards import router as dashboards_router
from mds.routers.platform import router as platform_router
from mds.routers.semantic import router as semantic_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    if settings.seed_demo_data:
        db = SessionLocal()
        try:
            seed_demo_data(db)
        finally:
            db.close()
    yield


app = FastAPI(title="MDS Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

app.include_router(platform_router, prefix="/api/v1")
app.include_router(semantic_router, prefix="/api/v1")
app.include_router(dashboards_router, prefix="/api/v1")
app.include_router(dashboards_router, prefix="/api/v2")
