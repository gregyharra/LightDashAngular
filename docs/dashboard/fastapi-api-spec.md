# Dashboard FastAPI API specification

This document describes the REST API the Angular dashboard feature expects. It is derived from:

- `src/app/features/dashboards/dashboard.service.ts`
- `src/app/core/models/dashboard.model.ts`
- `src/app/core/mock/fixtures/dashboards.fixture.ts`
- `src/app/core/api/lightdash-api.service.ts`

---

## Base URL and versioning

| Operation | Method | Path | API version |
|---|---|---|---|
| List dashboards | `GET` | `/api/v1/projects/{project_uuid}/dashboards` | v1 |
| Create dashboard | `POST` | `/api/v1/projects/{project_uuid}/dashboards` | v1 |
| Get dashboard | `GET` | `/api/v2/projects/{project_uuid}/dashboards/{dashboard_uuid}` | v2 |
| Update dashboard | `PATCH` | `/api/v2/projects/{project_uuid}/dashboards/{dashboard_uuid}` | v2 |

The Angular client prefixes paths with `/api/v1` or `/api/v2` automatically. All requests send `Content-Type: application/json` and `withCredentials: true` (cookies).

---

## Response envelope

Every endpoint must return the LightDash envelope:

**Success**

```json
{
  "status": "ok",
  "results": { }
}
```

**Error**

```json
{
  "status": "error",
  "error": {
    "name": "NotFoundError",
    "statusCode": 404,
    "message": "Dashboard not found",
    "data": null
  }
}
```

### FastAPI middleware example

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

app = FastAPI()

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "error": {
                "name": exc.detail if isinstance(exc.detail, str) else "HttpError",
                "statusCode": exc.status_code,
                "message": exc.detail if isinstance(exc.detail, str) else str(exc.detail),
            },
        },
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "error": {
                "name": "ValidationError",
                "statusCode": 422,
                "message": "Invalid request body",
                "data": exc.errors(),
            },
        },
    )

def ok(results):
    return {"status": "ok", "results": results}
```

---

## Shared types (Pydantic)

```python
from enum import Enum
from typing import Literal, Optional, Union
from uuid import UUID
from pydantic import BaseModel, Field, field_validator

class DashboardTileType(str, Enum):
    SAVED_CHART = "saved_chart"
    SQL_CHART = "sql_chart"
    MARKDOWN = "markdown"
    LOOM = "loom"
    HEADING = "heading"
    DATA_APP = "data_app"

GRID_COLS = 36

class UpdatedByUser(BaseModel):
    user_uuid: UUID = Field(alias="userUuid")
    first_name: str = Field(alias="firstName")
    last_name: str = Field(alias="lastName")

    model_config = {"populate_by_name": True}

class DashboardTab(BaseModel):
    uuid: UUID
    name: str
    order: int
    hidden: Optional[bool] = None

class TilePosition(BaseModel):
    x: int = Field(ge=0, lt=GRID_COLS)
    y: int = Field(ge=0)
    w: int = Field(ge=1, le=GRID_COLS)
    h: int = Field(ge=1)

    @field_validator("x")
    @classmethod
    def x_fits_grid(cls, v, info):
        w = info.data.get("w", 1)
        if v + w > GRID_COLS:
            raise ValueError(f"x + w must be <= {GRID_COLS}")
        return v

class SavedChartTileProperties(BaseModel):
    title: Optional[str] = None
    hide_title: Optional[bool] = Field(default=None, alias="hideTitle")
    saved_chart_uuid: Optional[UUID] = Field(default=None, alias="savedChartUuid")
    chart_name: Optional[str] = Field(default=None, alias="chartName")
    last_version_chart_kind: Optional[str] = Field(default=None, alias="lastVersionChartKind")

    model_config = {"populate_by_name": True}

class MarkdownTileProperties(BaseModel):
    title: str
    content: str
    hide_frame: Optional[bool] = Field(default=None, alias="hideFrame")

    model_config = {"populate_by_name": True}

class HeadingTileProperties(BaseModel):
    text: str
    show_divider: Optional[bool] = Field(default=None, alias="showDivider")

    model_config = {"populate_by_name": True}

class DashboardTileBase(TilePosition):
    uuid: UUID
    tab_uuid: Optional[UUID] = Field(alias="tabUuid")

    model_config = {"populate_by_name": True}

class SavedChartTile(DashboardTileBase):
    type: Literal[DashboardTileType.SAVED_CHART]
    properties: SavedChartTileProperties

class MarkdownTile(DashboardTileBase):
    type: Literal[DashboardTileType.MARKDOWN]
    properties: MarkdownTileProperties

class HeadingTile(DashboardTileBase):
    type: Literal[DashboardTileType.HEADING]
    properties: HeadingTileProperties

DashboardTile = Union[SavedChartTile, MarkdownTile, HeadingTile]
```

Use `model_config = {"populate_by_name": True}` (Pydantic v2) so responses serialize with **camelCase** keys matching the TypeScript models.

---

## Endpoints

### 1. List dashboards

```
GET /api/v1/projects/{project_uuid}/dashboards?includePrivate=false
```

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `includePrivate` | boolean | `false` | Include private dashboards the user can access |

**Response `results`**: array of `DashboardBasicDetailsWithTileTypes`

```json
[
  {
    "uuid": "d4e5f6a7-b8c9-0123-def0-234567890123",
    "name": "Executive Overview",
    "description": "Key business metrics at a glance",
    "projectUuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "organizationUuid": "org-uuid",
    "spaceUuid": "space-uuid",
    "spaceName": "Shared",
    "updatedAt": "2024-06-01T12:00:00.000Z",
    "updatedByUser": {
      "userUuid": "user-uuid",
      "firstName": "Demo",
      "lastName": "Analyst"
    },
    "views": 42,
    "firstViewedAt": "2024-01-15T08:00:00.000Z",
    "pinnedListUuid": null,
    "pinnedListOrder": null,
    "verification": null,
    "tileTypes": ["heading", "saved_chart", "markdown"]
  }
]
```

**Backend notes**

- `tileTypes` is a deduplicated list of tile type strings present on the dashboard (derived from tiles, not stored separately unless you denormalize for performance).
- Filter by `project_uuid` and optionally by space visibility / ACL.

---

### 2. Create dashboard

```
POST /api/v1/projects/{project_uuid}/dashboards
```

**Request body** (`CreateDashboardPayload`)

```json
{
  "name": "My dashboard",
  "description": "Optional description",
  "spaceUuid": "space-uuid",
  "tabs": [],
  "tiles": []
}
```

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Trimmed; frontend blocks empty names |
| `description` | no | |
| `spaceUuid` | no | Defaults to project default space |
| `tabs` | no | Frontend sends `[]`; backend should create default tab if empty |
| `tiles` | no | Frontend sends `[]` on create |

**Response `results`**: full `Dashboard` object (same shape as GET detail).

**Server-side create behavior** (mirrors mock fixture):

1. Generate `uuid`, `slug` (slugify name), `versionUuid`.
2. Set `dashboardVersionId = 1`, `views = 0`, `firstViewedAt = null`.
3. Resolve `organizationUuid` from project, `spaceName` from space.
4. If `tabs` is empty, create one tab: `{ uuid, name: "Tab 1", order: 0 }`.
5. Return complete dashboard with empty `tiles` unless provided.

```python
import re
from datetime import datetime, timezone
from uuid import uuid4

def slugify(name: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", name.lower().strip())
    slug = re.sub(r"[\s_-]+", "-", slug).strip("-")
    return slug or "dashboard"

def default_tab() -> dict:
    return {"uuid": str(uuid4()), "name": "Tab 1", "order": 0}
```

---

### 3. Get dashboard (detail)

```
GET /api/v2/projects/{project_uuid}/dashboards/{dashboard_uuid}
```

**Response `results`**: full `Dashboard`

```json
{
  "uuid": "d4e5f6a7-b8c9-0123-def0-234567890123",
  "name": "Executive Overview",
  "description": "Key business metrics at a glance",
  "slug": "executive-overview",
  "projectUuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "organizationUuid": "org-uuid",
  "spaceUuid": "space-uuid",
  "spaceName": "Shared",
  "dashboardVersionId": 1,
  "versionUuid": "f1f1f1f1-a2a2-4b2b-c2c2-d2d2d2d2d2d2",
  "updatedAt": "2024-06-01T12:00:00.000Z",
  "updatedByUser": {
    "userUuid": "user-uuid",
    "firstName": "Demo",
    "lastName": "Analyst"
  },
  "views": 42,
  "firstViewedAt": "2024-01-15T08:00:00.000Z",
  "pinnedListUuid": null,
  "pinnedListOrder": null,
  "tabs": [
    { "uuid": "tab-uuid", "name": "Overview", "order": 0 }
  ],
  "tiles": [
    {
      "uuid": "tile-uuid",
      "type": "heading",
      "x": 0, "y": 0, "w": 36, "h": 2,
      "tabUuid": "tab-uuid",
      "properties": { "text": "Executive summary", "showDivider": true }
    },
    {
      "uuid": "tile-uuid-2",
      "type": "saved_chart",
      "x": 0, "y": 2, "w": 18, "h": 9,
      "tabUuid": "tab-uuid",
      "properties": {
        "title": "Revenue by month",
        "savedChartUuid": "chart-uuid",
        "chartName": "Revenue by month",
        "lastVersionChartKind": "vertical_bar"
      }
    }
  ],
  "filters": {
    "dimensions": [],
    "metrics": [],
    "tableCalculations": []
  },
  "inheritsFromOrgOrProject": false,
  "access": [],
  "colorPaletteUuid": null,
  "verification": null,
  "config": {
    "isDateZoomDisabled": false,
    "isAddFilterDisabled": false
  }
}
```

**404** if dashboard does not exist or does not belong to the project.

---

### 4. Update dashboard

```
PATCH /api/v2/projects/{project_uuid}/dashboards/{dashboard_uuid}
```

This is the endpoint used when saving the **edit page**. The frontend sends the **entire** draft state for `tabs` and `tiles` — not per-tile patches.

**Request body** (`UpdateDashboardPayload`)

```json
{
  "name": "Executive Overview",
  "description": "Updated description",
  "tabs": [
    { "uuid": "tab-uuid", "name": "Overview", "order": 0 }
  ],
  "tiles": [
    {
      "uuid": "tile-uuid",
      "type": "saved_chart",
      "x": 9,
      "y": 0,
      "w": 18,
      "h": 9,
      "tabUuid": "tab-uuid",
      "properties": {
        "title": "Revenue by month",
        "savedChartUuid": "chart-uuid",
        "chartName": "Revenue by month",
        "lastVersionChartKind": "vertical_bar"
      }
    }
  ]
}
```

All fields are optional, but the edit page always sends `name`, `description`, `tabs`, and `tiles` together.

**Response `results`**: updated full `Dashboard`.

**Server-side update behavior** (mirrors mock fixture):

1. Load existing dashboard; return 404 if missing.
2. Apply `name` / `description` (recompute `slug` when name changes).
3. **Replace** `tabs` and `tiles` arrays with request payload (full snapshot semantics).
4. Increment `dashboardVersionId`.
5. Generate new `versionUuid`.
6. Set `updatedAt` to now; set `updatedByUser` from authenticated session.
7. Recompute `tileTypes` for list view if denormalized.

```python
from datetime import datetime, timezone

async def update_dashboard(dashboard_uuid: UUID, payload: UpdateDashboardPayload, user):
    existing = await repo.get_dashboard(dashboard_uuid)
    if not existing:
        raise HTTPException(404, "Dashboard not found")

    updated = {
        **existing,
        "name": payload.name.strip() if payload.name else existing["name"],
        "description": payload.description,
        "tabs": payload.tabs if payload.tabs is not None else existing["tabs"],
        "tiles": payload.tiles if payload.tiles is not None else existing["tiles"],
        "dashboardVersionId": existing["dashboardVersionId"] + 1,
        "versionUuid": str(uuid4()),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "updatedByUser": user.to_summary(),
    }
    if payload.name:
        updated["slug"] = slugify(payload.name)

    await repo.save_dashboard(updated)
    return updated
```

---

## Validation rules (recommended on the server)

The frontend runs collision resolution client-side (`applyTileLayoutChange`), but the backend should still validate persisted data.

### Grid constraints

| Rule | Value |
|---|---|
| Columns | 36 (`DASHBOARD_GRID_COLS`) |
| `x` | `0 <= x` and `x + w <= 36` |
| `y` | `>= 0` |
| `w` | `1 <= w <= 36` |
| `h` | `>= 1` |

### Tile integrity

- Every `tile.tabUuid` must reference a tab in `tabs` (or be `null` for legacy dashboards).
- Tile `uuid` values must be unique within the dashboard.
- `saved_chart` tiles: `savedChartUuid` should reference an existing chart in the same project (FK or existence check).
- No two tiles on the same tab should overlap (optional strict check — see layout validation below).

### Tab integrity

- Tab `order` values should be contiguous `0..n-1` (frontend maintains this after delete).
- At least one tab must remain (frontend blocks deleting the last tab).

### Layout overlap check (Python port)

```python
def tiles_collide(a: dict, b: dict) -> bool:
    return not (
        a["x"] + a["w"] <= b["x"]
        or a["x"] >= b["x"] + b["w"]
        or a["y"] + a["h"] <= b["y"]
        or a["y"] >= b["y"] + b["h"]
    )

def layout_has_overlaps(tiles: list[dict]) -> bool:
    for i, a in enumerate(tiles):
        for b in tiles[i + 1:]:
            if tiles_collide(a, b):
                return True
    return False
```

Return `422` with a clear message if overlaps are detected, unless you choose to auto-compact server-side (not required — the client already compacts before save).

---

## FastAPI router skeleton

```python
from fastapi import APIRouter, Depends, Query
from uuid import UUID

router = APIRouter(prefix="/projects/{project_uuid}/dashboards", tags=["dashboards"])

@router.get("")
async def list_dashboards(
    project_uuid: UUID,
    include_private: bool = Query(False, alias="includePrivate"),
    user=Depends(get_current_user),
):
    dashboards = await dashboard_service.list(project_uuid, user, include_private)
    return ok(dashboards)

@router.post("")
async def create_dashboard(
    project_uuid: UUID,
    body: CreateDashboardPayload,
    user=Depends(get_current_user),
):
    dashboard = await dashboard_service.create(project_uuid, body, user)
    return ok(dashboard)

@router.get("/{dashboard_uuid}")
async def get_dashboard(
    project_uuid: UUID,
    dashboard_uuid: UUID,
    user=Depends(get_current_user),
):
    dashboard = await dashboard_service.get(project_uuid, dashboard_uuid, user)
    return ok(dashboard)

@router.patch("/{dashboard_uuid}")
async def update_dashboard(
    project_uuid: UUID,
    dashboard_uuid: UUID,
    body: UpdateDashboardPayload,
    user=Depends(get_current_user),
):
    dashboard = await dashboard_service.update(project_uuid, dashboard_uuid, body, user)
    return ok(dashboard)
```

Mount the same router under both prefixes:

```python
app.include_router(router, prefix="/api/v1")
app.include_router(router, prefix="/api/v2")
```

Or split so only `GET`/`PATCH` by id are registered on v2 if you want stricter versioning.

---

## Authentication and authorization

The Angular client sends cookies (`withCredentials: true`). For FastAPI:

- Use session cookies or JWT in HttpOnly cookies to match the existing LightDash auth model.
- Enforce project-level access on every endpoint.
- Optionally enforce space-level permissions when `spaceUuid` is set.

Minimum checks:

| Endpoint | Authorization |
|---|---|
| List | User has `view` on project |
| Create | User has `create` on project / space |
| Get | User has `view` on dashboard |
| Update | User has `edit` on dashboard |

---

## Fields not mutated by the current frontend

These are returned on GET but are **not** sent on PATCH today. Preserve them unchanged unless you add new UI:

- `filters`
- `inheritsFromOrgOrProject`
- `access`
- `colorPaletteUuid`
- `verification`
- `config`
- `views` / `firstViewedAt` (increment `views` on view, not on edit)
- `pinnedListUuid` / `pinnedListOrder`

---

## Testing against the Angular app

1. Set `useMockApi: false` in `src/environments/environment.ts`.
2. Configure `proxy.conf.json` to forward `/api` to your FastAPI server (e.g. port 8000).
3. Run the Playwright spec `e2e/dashboard-tile-rearrangement.spec.ts` — it verifies drag-rearrange, no overlaps, and persistence via `PATCH` + reload on view page.

---

## Error codes reference

| HTTP | `error.name` | When |
|---|---|---|
| 400 | `BadRequestError` | Invalid tile/tab references |
| 401 | `UnauthorizedError` | No session |
| 403 | `ForbiddenError` | No project/dashboard permission |
| 404 | `NotFoundError` | Dashboard or project not found |
| 422 | `ValidationError` | Pydantic / layout validation failure |
| 500 | `InternalServerError` | Unexpected failure |
