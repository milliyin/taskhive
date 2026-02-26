"""Node: Auto-complete task and trigger credit flow when verdict is PASS."""

import requests
from state import ReviewerState


def complete_task(state: ReviewerState) -> dict:
    """
    If verdict is PASS, accept the deliverable via the API.
    This triggers: task -> completed, credits flow to agent operator.
    """
    if state.get("error"):
        return {}

    verdict = state.get("verdict")

    if verdict != "pass":
        if verdict == "fail":
            print("  [FAIL] FAIL verdict -- requesting revision")
            # Request revision via API
            url = f"{state['taskhive_url']}/api/v1/tasks/{state['task_id']}/deliverables/{state['deliverable_id']}/revision"
            headers = {
                "Authorization": f"Bearer {state['taskhive_api_key']}",
                "Content-Type": "application/json",
            }

            feedback = state.get("feedback", "Requirements not fully met.")
            missing = state.get("scores", {})
            revision_notes = f"[Auto-Review FAIL]\n\n{feedback}"
            if missing:
                revision_notes += f"\n\nScores: {missing}"

            try:
                resp = requests.post(url, headers=headers, json={
                    "revision_notes": revision_notes,
                }, timeout=15)

                if resp.status_code == 200:
                    print("  [OK] Revision requested -- freelancer can resubmit")
                    return {"task_completed": False, "credits_flowed": False}
                else:
                    print(f"  [!!] Revision request returned {resp.status_code}")
            except Exception as e:
                print(f"  [!!] Could not request revision: {e}")

        return {"task_completed": False, "credits_flowed": False}

    # --- PASS: Accept deliverable ------------------------------------
    print("  [PASS] Auto-completing task and flowing credits...")

    url = f"{state['taskhive_url']}/api/v1/tasks/{state['task_id']}/deliverables/{state['deliverable_id']}/accept"
    headers = {
        "Authorization": f"Bearer {state['taskhive_api_key']}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(url, headers=headers, timeout=15)

        if resp.status_code == 200:
            print("  [OK] Task completed! Credits flowed to agent operator.")
            return {"task_completed": True, "credits_flowed": True}
        else:
            error_data = resp.json()
            msg = error_data.get("error", {}).get("message", resp.status_code)
            print(f"  [!!] Accept failed: {msg}")
            return {"task_completed": False, "credits_flowed": False, "error": f"Accept failed: {msg}"}

    except Exception as e:
        print(f"  [!!] Could not accept deliverable: {e}")
        return {"task_completed": False, "credits_flowed": False, "error": str(e)}
