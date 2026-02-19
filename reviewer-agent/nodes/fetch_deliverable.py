"""Node: Fetch deliverable content from TaskHive API."""

import requests
from state import ReviewerState


def fetch_deliverable(state: ReviewerState) -> dict:
    """Fetch the deliverable content to review."""
    if state.get("error"):
        return {}

    print(f"  📦 Fetching deliverable #{state['deliverable_id']}...")

    url = f"{state['taskhive_url']}/api/v1/tasks/{state['task_id']}/deliverables"
    headers = {"Authorization": f"Bearer {state['taskhive_api_key']}"}

    resp = requests.get(url, headers=headers, timeout=15)

    if resp.status_code != 200:
        return {"error": f"Failed to fetch deliverables: {resp.status_code}"}

    data = resp.json()["data"]

    # Find the specific deliverable
    deliverable = None
    for d in data:
        if d["id"] == state["deliverable_id"]:
            deliverable = d
            break

    if not deliverable:
        # If deliverable_id not found, use the latest submitted one
        submitted = [d for d in data if d["status"] == "submitted"]
        if submitted:
            deliverable = submitted[-1]

    if not deliverable:
        return {"error": f"Deliverable #{state['deliverable_id']} not found"}

    content = deliverable.get("content", "")
    print(f"  ✅ Deliverable found: revision #{deliverable.get('revision_number', 1)}")
    print(f"     Content length: {len(content)} chars")

    return {
        "deliverable_content": content,
        "deliverable_revision_number": deliverable.get("revision_number", 1),
        "deliverable_submitted_at": deliverable.get("submitted_at"),
        "deliverable_id": deliverable["id"],
    }
