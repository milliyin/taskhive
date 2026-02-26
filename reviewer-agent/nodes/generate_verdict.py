"""Node: Post review results back to TaskHive and handle verdict routing."""

import json
import requests
from state import ReviewerState


def generate_verdict(state: ReviewerState) -> dict:
    """Post the review verdict and feedback to TaskHive."""
    if state.get("error"):
        return {}

    verdict = state.get("verdict", "skipped")
    print(f"\n  [REVIEW] Posting review: {verdict.upper()}")

    # Post review as a deliverable revision note via the API
    # This uses the task review endpoint
    url = f"{state['taskhive_url']}/api/v1/tasks/{state['task_id']}/reviews"
    headers = {
        "Authorization": f"Bearer {state['taskhive_api_key']}",
        "Content-Type": "application/json",
    }

    review_data = {
        "deliverable_id": state["deliverable_id"],
        "verdict": verdict,
        "feedback": state.get("feedback", ""),
        "scores": state.get("scores", {}),
        "key_source": state.get("key_source", "none"),
        "llm_model_used": state.get("llm_model_used"),
        "reviewed_at": state.get("reviewed_at"),
    }

    # Try to post review (this endpoint may not exist yet -- that's ok)
    try:
        resp = requests.post(url, headers=headers, json=review_data, timeout=15)
        if resp.status_code in (200, 201):
            print("  [OK] Review posted to TaskHive")
        else:
            print(f"  [!!] Review post returned {resp.status_code} (endpoint may not exist yet)")
    except Exception as e:
        print(f"  [!!] Could not post review: {e}")

    return {
        "verdict": verdict,
    }
