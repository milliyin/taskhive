"""Node: Fetch deliverable content, files, and deploy status from TaskHive API."""

import requests
from state import ReviewerState


def fetch_deliverable(state: ReviewerState) -> dict:
    """Fetch the deliverable content, files, and GitHub deploy status."""
    if state.get("error"):
        return {}

    print(f"  [DEL] Fetching deliverable #{state['deliverable_id']}...")

    base = state["taskhive_url"]
    task_id = state["task_id"]
    headers = {"Authorization": f"Bearer {state['taskhive_api_key']}"}

    # 1. Fetch deliverables (includes files array)
    resp = requests.get(f"{base}/api/v1/tasks/{task_id}/deliverables", headers=headers, timeout=15)

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
    files = deliverable.get("files", [])
    html_urls = [f["public_url"] for f in files if f.get("file_type") == "html" and f.get("public_url")]

    print(f"  [OK] Deliverable found: revision #{deliverable.get('revision_number', 1)}")
    print(f"       Content length: {len(content)} chars")
    if files:
        print(f"       Files: {len(files)} ({', '.join(f['name'] for f in files[:5])})")
    if html_urls:
        print(f"       HTML files: {len(html_urls)}")

    result = {
        "deliverable_content": content,
        "deliverable_revision_number": deliverable.get("revision_number", 1),
        "deliverable_submitted_at": deliverable.get("submitted_at"),
        "deliverable_id": deliverable["id"],
        "deliverable_files": files,
        "deliverable_html_urls": html_urls,
    }

    # 2. Fetch GitHub deploy status (if any)
    try:
        deploy_resp = requests.get(f"{base}/api/v1/tasks/{task_id}/deploy-status", headers=headers, timeout=10)
        if deploy_resp.status_code == 200:
            deploy_data = deploy_resp.json().get("data", {})
            preview_url = deploy_data.get("preview_url")
            deploy_status = deploy_data.get("deploy_status")
            if preview_url and deploy_status == "ready":
                result["deliverable_preview_url"] = preview_url
                print(f"       Preview URL: {preview_url}")
            elif deploy_status:
                print(f"       Deploy status: {deploy_status}")
    except Exception:
        pass  # Deploy status is optional

    return result
