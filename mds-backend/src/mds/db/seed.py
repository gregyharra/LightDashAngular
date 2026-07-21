import re
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from mds.db.models import Dashboard, Project, SavedChart, Space, User, Warehouse

MOCK_USER_UUID = uuid.UUID("b264d83a-9000-426a-85ec-3f9c20f368ce")
MOCK_PROJECT_UUID = uuid.UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
MOCK_PROJECT_2_UUID = uuid.UUID("b2c3d4e5-f6a7-8901-bcde-f12345678901")
MOCK_SPACE_UUID = uuid.UUID("c3d4e5f6-a7b8-9012-cdef-123456789012")
MOCK_DASHBOARD_UUID = uuid.UUID("d4e5f6a7-b8c9-0123-def0-234567890123")
MOCK_TAB_UUID = uuid.UUID("a1a1a1a1-b1b1-4c1c-d1d1-e1e1e1e1e1e1")
MOCK_CHART_4_UUID = uuid.UUID("a4b5c6d7-e8f9-4012-abcd-ef1234567894")
MOCK_CHART_5_UUID = uuid.UUID("b5c6d7e8-f9a0-4123-bcde-f12345678905")
MOCK_CHART_6_UUID = uuid.UUID("c6d7e8f9-a0b1-4234-cdef-123456789016")


MOCK_CHART_6_UUID = uuid.UUID("c6d7e8f9-a0b1-4234-cdef-123456789016")

_ORDERS_ORDER_COUNT = "orders_order_count"
_ORDERS_TOTAL_REVENUE = "orders_total_revenue"
_ORDERS_ORDER_DATE = "orders_order_date"


def _big_number_metric_query(metric_field: str) -> dict:
    return {
        "exploreName": "orders",
        "dimensions": [],
        "metrics": [metric_field],
        "filters": {},
        "sorts": [],
        "limit": 1,
        "tableCalculations": [],
        "additionalMetrics": [],
    }


def _revenue_by_month_metric_query() -> dict:
    return {
        "exploreName": "orders",
        "dimensions": [_ORDERS_ORDER_DATE],
        "metrics": [_ORDERS_TOTAL_REVENUE],
        "filters": {},
        "sorts": [{"fieldId": _ORDERS_ORDER_DATE, "descending": False}],
        "limit": 500,
        "tableCalculations": [],
        "additionalMetrics": [],
    }


def seed_demo_charts(db: Session, project_uuid: uuid.UUID, space_uuid: uuid.UUID) -> None:
    now = datetime(2024, 6, 1, 10, 0, tzinfo=timezone.utc)
    charts = [
        SavedChart(
            uuid=MOCK_CHART_4_UUID,
            project_uuid=project_uuid,
            space_uuid=space_uuid,
            name="How many orders have we fulfilled??",
            description="Total fulfilled orders",
            chart_kind="big_number",
            table_name="orders",
            metric_query=_big_number_metric_query(_ORDERS_ORDER_COUNT),
            chart_config={"type": "big_number", "yField": _ORDERS_ORDER_COUNT},
            views=31,
            first_viewed_at=datetime(2024, 2, 1, 10, 0, tzinfo=timezone.utc),
            updated_at=now,
            updated_by_user_uuid=MOCK_USER_UUID,
            is_private=False,
            access=[],
            pinned_list_uuid=None,
            pinned_list_order=None,
        ),
        SavedChart(
            uuid=MOCK_CHART_5_UUID,
            project_uuid=project_uuid,
            space_uuid=space_uuid,
            name="What is our total revenue this month?",
            description="Total revenue KPI",
            chart_kind="big_number",
            table_name="orders",
            metric_query=_big_number_metric_query(_ORDERS_TOTAL_REVENUE),
            chart_config={"type": "big_number", "yField": _ORDERS_TOTAL_REVENUE},
            views=28,
            first_viewed_at=datetime(2024, 2, 1, 10, 0, tzinfo=timezone.utc),
            updated_at=now,
            updated_by_user_uuid=MOCK_USER_UUID,
            is_private=False,
            access=[],
            pinned_list_uuid=None,
            pinned_list_order=None,
        ),
        SavedChart(
            uuid=MOCK_CHART_6_UUID,
            project_uuid=project_uuid,
            space_uuid=space_uuid,
            name="Revenue by month",
            description="Monthly revenue trend from order amounts",
            chart_kind="vertical_bar",
            table_name="orders",
            metric_query=_revenue_by_month_metric_query(),
            chart_config={
                "type": "vertical_bar",
                "xField": _ORDERS_ORDER_DATE,
                "yField": _ORDERS_TOTAL_REVENUE,
                "displayConfig": {
                    "seriesColor": "#e67700",
                    "showValueLabels": True,
                    "showLegend": False,
                },
            },
            views=25,
            first_viewed_at=datetime(2024, 2, 1, 10, 0, tzinfo=timezone.utc),
            updated_at=now,
            updated_by_user_uuid=MOCK_USER_UUID,
            is_private=False,
            access=[],
            pinned_list_uuid=None,
            pinned_list_order=None,
        ),
    ]
    db.add_all(charts)


def slugify(name: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", name.lower().strip())
    slug = re.sub(r"[\s_-]+", "-", slug).strip("-")
    return slug or "dashboard"


def seed_demo_data(db: Session) -> None:
    if db.get(User, MOCK_USER_UUID):
        return

    user = User(
        uuid=MOCK_USER_UUID,
        email="demo@lightdash.com",
        first_name="Demo",
        last_name="Analyst",
        role="admin",
    )
    project1 = Project(
        uuid=MOCK_PROJECT_UUID,
        name="Jaffle Shop",
        warehouse_type="trino",
        created_by_user_uuid=MOCK_USER_UUID,
    )
    project2 = Project(
        uuid=MOCK_PROJECT_2_UUID,
        name="Marketing Analytics",
        warehouse_type="bigquery",
        created_by_user_uuid=MOCK_USER_UUID,
    )
    space = Space(
        uuid=MOCK_SPACE_UUID,
        project_uuid=MOCK_PROJECT_UUID,
        name="Shared",
        is_private=False,
    )
    db.add(user)
    db.flush()
    db.add_all([project1, project2, space])
    db.flush()

    seed_demo_charts(db, MOCK_PROJECT_UUID, MOCK_SPACE_UUID)

    dashboard = Dashboard(
        uuid=MOCK_DASHBOARD_UUID,
        project_uuid=MOCK_PROJECT_UUID,
        space_uuid=MOCK_SPACE_UUID,
        name="🧭 KPI dashboard",
        description="Key business metrics at a glance",
        slug="kpi-dashboard",
        dashboard_version_id=1,
        version_uuid=uuid.UUID("f1f1f1f1-a2a2-4b2b-c2c2-d2d2d2d2d2d2"),
        views=42,
        first_viewed_at=datetime(2024, 1, 15, 8, 0, tzinfo=timezone.utc),
        updated_by_user_uuid=MOCK_USER_UUID,
        tabs=[
            {"uuid": str(MOCK_TAB_UUID), "name": "Overview", "order": 0},
        ],
        tiles=[
            {
                "uuid": "11111111-1111-1111-1111-111111111101",
                "type": "heading",
                "x": 0,
                "y": 0,
                "w": 36,
                "h": 2,
                "tabUuid": str(MOCK_TAB_UUID),
                "properties": {"text": "Stats at a glance 👀", "showDivider": False},
            },
            {
                "uuid": "11111111-1111-1111-1111-111111111106",
                "type": "saved_chart",
                "x": 0,
                "y": 5,
                "w": 12,
                "h": 5,
                "tabUuid": str(MOCK_TAB_UUID),
                "properties": {
                    "title": "How many orders have we fulfilled??",
                    "savedChartUuid": str(MOCK_CHART_4_UUID),
                    "chartName": "How many orders have we fulfilled??",
                    "lastVersionChartKind": "big_number",
                },
            },
            {
                "uuid": "11111111-1111-1111-1111-111111111107",
                "type": "saved_chart",
                "x": 12,
                "y": 5,
                "w": 12,
                "h": 5,
                "tabUuid": str(MOCK_TAB_UUID),
                "properties": {
                    "title": "What is our total revenue this month?",
                    "savedChartUuid": str(MOCK_CHART_5_UUID),
                    "chartName": "What is our total revenue this month?",
                    "lastVersionChartKind": "big_number",
                },
            },
            {
                "uuid": "11111111-1111-1111-1111-111111111108",
                "type": "saved_chart",
                "x": 24,
                "y": 5,
                "w": 12,
                "h": 5,
                "tabUuid": str(MOCK_TAB_UUID),
                "properties": {
                    "title": "Revenue by month",
                    "savedChartUuid": str(MOCK_CHART_6_UUID),
                    "chartName": "Revenue by month",
                    "lastVersionChartKind": "vertical_bar",
                },
            },
        ],
        filters={"dimensions": [], "metrics": [], "tableCalculations": []},
        config={
            "isDateZoomDisabled": False,
            "isAddFilterDisabled": False,
            "dateZoomGranularities": ["Day", "Week", "Month", "Quarter", "Year"],
            "defaultDateZoomGranularity": "Month",
        },
        inherits_from_org_or_project=False,
        access=[],
        color_palette_uuid=None,
        verification=None,
        pinned_list_uuid=None,
        pinned_list_order=None,
    )
    db.add(dashboard)
    db.commit()
