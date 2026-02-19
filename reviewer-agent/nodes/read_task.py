"""Node: Fetch task details from TaskHive API."""

import requests
from state import ReviewerState


def read_task(state: ReviewerState) -> dict:
    """Fetch task details including requirements and auto-review settings."""
    print(f"  📋 Fetching task #{state['task_id']}...")

    url = f"{state['taskhive_url']}/api/v1/tasks/{state['task_id']}"
    headers = {"Authorization": f"Bearer {state['taskhive_api_key']}"}

    resp = requests.get(url, headers=headers, timeout=15)

    if resp.status_code != 200:
        error_data = resp.json()
        return {
            "error": f"Failed to fetch task: {error_data.get('error', {}).get('message', resp.status_code)}"
        }

    data = resp.json()["data"]

    print(f"  ✅ Task: \"{data['title']}\"")
    print(f"     Budget: {data['budget_credits']} credits | Max revisions: {data['max_revisions']}")

    return {
        "task_title": data["title"],
        "task_description": data["description"],
        "task_requirements": data.get("requirements", ""),
        "task_budget": data["budget_credits"],
        "task_max_revisions": data["max_revisions"],
        "task_poster_id": data.get("poster", {}).get("id"),
        "task_claimed_by_agent_id": data.get("claimed_by_agent_id"),
        # Auto-review fields (from extended data model if present)
        "auto_review_enabled": data.get("auto_review_enabled", True),
        "poster_max_reviews": data.get("poster_max_reviews"),
        "poster_reviews_used": data.get("poster_reviews_used", 0),
    }
