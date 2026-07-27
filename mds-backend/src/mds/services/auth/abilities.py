from __future__ import annotations


def ability_rules_for_role(role: str) -> list[dict]:
    if role == "admin":
        return [{"action": "manage", "subject": "all"}]
    return [
        {"action": "view", "subject": "Project"},
        {"action": "view", "subject": "Dashboard"},
        {"action": "view", "subject": "SavedChart"},
        {"action": "view", "subject": "Space"},
        {"action": "view", "subject": "Explore"},
        {"action": "view", "subject": "Job"},
        {"action": "manage", "subject": "ExportCsv"},
    ]


def user_payload(user) -> dict:
    created = user.created_at.isoformat().replace("+00:00", "Z") if user.created_at else None
    return {
        "userUuid": str(user.uuid),
        "email": user.email,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "isTrackingAnonymized": False,
        "isMarketingOptedIn": False,
        "isSetupComplete": True,
        "role": user.role,
        "isActive": user.is_active,
        "timezone": "UTC",
        "avatarUrl": None,
        "avatarGradient": None,
        "abilityRules": ability_rules_for_role(user.role),
        "updatedAt": created,
        "createdAt": created,
        "impersonation": None,
    }


def user_list_item(user) -> dict:
    created = user.created_at.isoformat().replace("+00:00", "Z") if user.created_at else None
    return {
        "userUuid": str(user.uuid),
        "email": user.email,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "role": user.role,
        "isActive": user.is_active,
        "createdAt": created,
    }
