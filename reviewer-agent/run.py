#!/usr/bin/env python3
"""
TaskHive Reviewer Agent -- Entry Point

Usage:
    python run.py --task-id 42 --deliverable-id 8
    python run.py --poll                          (poll for new deliverables)
    python run.py --webhook --port 8000           (listen for webhook events)

Environment variables (set in .env or shell):
    TASKHIVE_URL            - Base URL (default: https://taskhive-six.vercel.app)
    TASKHIVE_API_KEY        - Agent API key (required)
    WEBHOOK_SECRET          - Webhook secret for signature verification (required for --webhook)
"""

import os
from pathlib import Path

# Load .env from project root (parent of reviewer-agent/)
from dotenv import load_dotenv
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

import sys
import json
import argparse
import time
import requests
from datetime import datetime, timezone

from graph import reviewer_graph
from state import ReviewerState


BANNER = """
+----------------------------------------------------------+
|   TaskHive Reviewer Agent -- AI-Powered Code Review       |
|   Built with LangGraph                                    |
+----------------------------------------------------------+
"""


def run_review(task_id: int, deliverable_id: int, taskhive_url: str, taskhive_api_key: str) -> dict:
    """Run the reviewer agent on a specific deliverable."""

    print(f"\n{'=' * 60}")
    print(f"  Reviewing Task #{task_id} / Deliverable #{deliverable_id}")
    print(f"{'=' * 60}")

    initial_state: ReviewerState = {
        "task_id": task_id,
        "deliverable_id": deliverable_id,
        "taskhive_url": taskhive_url,
        "taskhive_api_key": taskhive_api_key,
        # All other fields start as None -- populated by the graph nodes
        "task_title": None,
        "task_description": None,
        "task_requirements": None,
        "task_budget": None,
        "task_max_revisions": None,
        "task_poster_id": None,
        "task_claimed_by_agent_id": None,
        "auto_review_enabled": None,
        "poster_llm_provider": None,
        "poster_llm_key": None,
        "poster_max_reviews": None,
        "poster_reviews_used": None,
        "freelancer_llm_provider": None,
        "freelancer_llm_key": None,
        "resolved_api_key": None,
        "resolved_provider": None,
        "key_source": None,
        "deliverable_content": None,
        "deliverable_revision_number": None,
        "deliverable_submitted_at": None,
        "deliverable_files": None,
        "deliverable_preview_url": None,
        "deliverable_html_urls": None,
        "verdict": None,
        "feedback": None,
        "scores": None,
        "llm_model_used": None,
        "reviewed_at": None,
        "task_completed": None,
        "credits_flowed": None,
        "error": None,
    }

    # Run the graph
    result = reviewer_graph.invoke(initial_state)

    # Print summary
    print(f"\n{'=' * 60}")
    verdict = result.get("verdict", "error")
    if verdict == "pass":
        print("  VERDICT: PASS -- Task auto-completed, credits flowed!")
    elif verdict == "fail":
        print("  VERDICT: FAIL -- Revision requested")
    elif verdict == "skipped":
        print("  VERDICT: SKIPPED -- No LLM key, manual review needed")
    else:
        print(f"  ERROR: {result.get('error', 'Unknown error')}")

    if result.get("feedback"):
        print(f"\n  Feedback: {result['feedback'][:200]}...")
    if result.get("scores"):
        print(f"  Scores: {json.dumps(result['scores'])}")
    if result.get("llm_model_used"):
        print(f"  Model: {result['llm_model_used']}")
    print(f"{'=' * 60}")

    return result


def _collect_submitted_ids(taskhive_url: str, headers: dict) -> set:
    """Scan all delivered tasks and return the set of submitted deliverable IDs."""
    ids = set()
    try:
        resp = requests.get(
            f"{taskhive_url}/api/v1/tasks?status=delivered&limit=50",
            headers=headers, timeout=15,
        )
        if resp.status_code == 200:
            for task in resp.json().get("data", []):
                task_id = task.get("id")
                if not task_id:
                    continue
                del_resp = requests.get(
                    f"{taskhive_url}/api/v1/tasks/{task_id}/deliverables",
                    headers=headers, timeout=15,
                )
                if del_resp.status_code == 200:
                    for d in del_resp.json().get("data", []):
                        if d.get("status") == "submitted":
                            ids.add(d["id"])
    except Exception:
        pass
    return ids


def poll_for_deliverables(taskhive_url: str, taskhive_api_key: str, interval: int = 30):
    """Poll TaskHive for new submitted deliverables and review them."""
    headers = {"Authorization": f"Bearer {taskhive_api_key}"}

    # Initial scan -- remember existing deliverables so we only review NEW ones
    print("  [POLL] Scanning existing deliverables...")
    reviewed = _collect_submitted_ids(taskhive_url, headers)
    print(f"  [POLL] Found {len(reviewed)} existing submitted deliverable(s) -- skipping these")
    print(f"  [POLL] Watching for new deliverables every {interval} seconds")
    print("         Press Ctrl+C to stop\n")

    while True:
        try:
            # Fetch all tasks in "delivered" status (awaiting review)
            resp = requests.get(
                f"{taskhive_url}/api/v1/tasks?status=delivered&limit=50",
                headers=headers,
                timeout=15,
            )

            if resp.status_code == 200:
                tasks_data = resp.json().get("data", [])

                for task in tasks_data:
                    task_id = task.get("id")
                    if not task_id:
                        continue

                    # Check for submitted deliverables
                    del_resp = requests.get(
                        f"{taskhive_url}/api/v1/tasks/{task_id}/deliverables",
                        headers=headers,
                        timeout=15,
                    )

                    if del_resp.status_code == 200:
                        deliverables_data = del_resp.json().get("data", [])
                        for d in deliverables_data:
                            if d.get("status") == "submitted" and d["id"] not in reviewed:
                                print(f"\n  [NEW] New deliverable found: Task #{task_id}, Deliverable #{d['id']}")
                                run_review(task_id, d["id"], taskhive_url, taskhive_api_key)
                                reviewed.add(d["id"])
            else:
                print(f"  [!!] Tasks fetch returned {resp.status_code}")

            time.sleep(interval)

        except KeyboardInterrupt:
            print("\n  Polling stopped")
            break
        except Exception as e:
            print(f"  [!!] Poll error: {e}")
            time.sleep(interval)


def start_webhook_server(taskhive_url: str, taskhive_api_key: str, webhook_secret: str, port: int):
    """Start a Flask server that listens for TaskHive webhook events."""
    from webhook_server import create_webhook_app

    print(f"  [WEBHOOK] Webhook mode -- listening on http://0.0.0.0:{port}/webhook")
    print(f"            Health check: http://0.0.0.0:{port}/health")
    print("            Press Ctrl+C to stop\n")

    app = create_webhook_app(
        webhook_secret=webhook_secret,
        taskhive_url=taskhive_url,
        taskhive_api_key=taskhive_api_key,
        run_review_fn=run_review,
    )

    app.run(host="0.0.0.0", port=port, debug=False)


def main():
    print(BANNER)

    parser = argparse.ArgumentParser(description="TaskHive Reviewer Agent")
    parser.add_argument("--task-id", type=int, help="Task ID to review")
    parser.add_argument("--deliverable-id", type=int, help="Deliverable ID to review")
    parser.add_argument("--url", default=os.environ.get("TASKHIVE_URL", "https://taskhive-six.vercel.app"),
                        help="TaskHive base URL")
    parser.add_argument("--api-key", default=os.environ.get("TASKHIVE_API_KEY"),
                        help="TaskHive agent API key")
    parser.add_argument("--poll", action="store_true", help="Poll for new deliverables")
    parser.add_argument("--interval", type=int, default=30, help="Poll interval in seconds")
    parser.add_argument("--webhook", action="store_true", help="Start webhook listener server")
    parser.add_argument("--port", type=int, default=int(os.environ.get("WEBHOOK_PORT", "8000")),
                        help="Port for webhook server (default: 8000)")
    parser.add_argument("--secret", default=os.environ.get("WEBHOOK_SECRET"),
                        help="Webhook secret for signature verification")

    args = parser.parse_args()

    # Resolve API key
    api_key = args.api_key
    if not api_key:
        print("  [ERROR] No TaskHive API key provided!")
        print("          Set TASKHIVE_API_KEY env var or use --api-key flag")
        sys.exit(1)

    print(f"  Target: {args.url}")
    print(f"  API Key: {api_key[:20]}...")

    if args.webhook:
        # --- Webhook mode -------------------------------------------
        webhook_secret = args.secret
        if not webhook_secret:
            print("  [ERROR] No webhook secret provided!")
            print("          Set WEBHOOK_SECRET env var or use --secret flag")
            print("          The secret is returned when you register a webhook via POST /api/v1/webhooks")
            sys.exit(1)

        print(f"  Webhook Secret: {webhook_secret[:10]}... [OK]")
        start_webhook_server(args.url, api_key, webhook_secret, args.port)

    elif args.poll:
        # --- Poll mode ----------------------------------------------
        poll_for_deliverables(args.url, api_key, args.interval)

    elif args.task_id and args.deliverable_id:
        # --- Single review mode -------------------------------------
        result = run_review(args.task_id, args.deliverable_id, args.url, api_key)
        sys.exit(0 if result.get("verdict") in ("pass", "fail", "skipped") else 1)

    else:
        print("\n  Usage:")
        print("    python run.py --task-id 42 --deliverable-id 8    (single review)")
        print("    python run.py --poll                              (poll every 30s)")
        print("    python run.py --webhook --port 8000               (webhook listener)")
        print("\n  Required env vars: TASKHIVE_API_KEY")
        print("  For webhook mode:  WEBHOOK_SECRET")
        sys.exit(1)


if __name__ == "__main__":
    main()
