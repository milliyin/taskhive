#!/usr/bin/env python3
"""
TaskHive Reviewer Agent — Entry Point

Usage:
    python run.py --task-id 42 --deliverable-id 8
    python run.py --task-id 42 --deliverable-id 8 --url https://taskhive-six.vercel.app
    python run.py --poll  (polls for new deliverables and reviews them)

Environment variables (set in .env or shell):
    TASKHIVE_URL          - Base URL (default: https://taskhive-six.vercel.app)
    TASKHIVE_API_KEY      - Agent API key (required)
    OPENROUTER_API_KEY    - OpenRouter key for LLM reviews
    BROWSERBASE_API_KEY   - Browserbase key for URL verification
    BROWSERBASE_PROJECT_ID - Browserbase project ID
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
╔══════════════════════════════════════════════════════════╗
║   TaskHive Reviewer Agent — AI-Powered Code Review      ║
║   Built with LangGraph                                  ║
╚══════════════════════════════════════════════════════════╝
"""


def run_review(task_id: int, deliverable_id: int, taskhive_url: str, taskhive_api_key: str) -> dict:
    """Run the reviewer agent on a specific deliverable."""

    print(f"\n{'─' * 60}")
    print(f"  Reviewing Task #{task_id} / Deliverable #{deliverable_id}")
    print(f"{'─' * 60}")

    initial_state: ReviewerState = {
        "task_id": task_id,
        "deliverable_id": deliverable_id,
        "taskhive_url": taskhive_url,
        "taskhive_api_key": taskhive_api_key,
        # All other fields start as None
        "task_title": None,
        "task_description": None,
        "task_requirements": None,
        "task_budget": None,
        "task_max_revisions": None,
        "task_poster_id": None,
        "task_claimed_by_agent_id": None,
        "auto_review_enabled": None,
        "poster_llm_provider": None,
        "poster_llm_key": os.environ.get("POSTER_LLM_KEY"),
        "poster_max_reviews": None,
        "poster_reviews_used": None,
        "freelancer_llm_provider": None,
        "freelancer_llm_key": os.environ.get("FREELANCER_LLM_KEY"),
        "resolved_api_key": None,
        "resolved_provider": None,
        "key_source": None,
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
    print(f"\n{'═' * 60}")
    verdict = result.get("verdict", "error")
    if verdict == "pass":
        print("  🎉 VERDICT: PASS — Task auto-completed, credits flowed!")
    elif verdict == "fail":
        print("  ❌ VERDICT: FAIL — Revision requested")
    elif verdict == "skipped":
        print("  ⏭️  VERDICT: SKIPPED — No LLM key, manual review needed")
    else:
        print(f"  🛑 ERROR: {result.get('error', 'Unknown error')}")

    if result.get("feedback"):
        print(f"\n  Feedback: {result['feedback'][:200]}...")
    if result.get("scores"):
        print(f"  Scores: {json.dumps(result['scores'])}")
    if result.get("llm_model_used"):
        print(f"  Model: {result['llm_model_used']}")
    print(f"{'═' * 60}")

    return result


def poll_for_deliverables(taskhive_url: str, taskhive_api_key: str, interval: int = 30):
    """Poll TaskHive for new submitted deliverables and review them."""
    print("  🔄 Polling mode — checking for new deliverables every", interval, "seconds")
    print("     Press Ctrl+C to stop\n")

    reviewed = set()
    headers = {"Authorization": f"Bearer {taskhive_api_key}"}

    while True:
        try:
            # Get agent's active tasks
            resp = requests.get(
                f"{taskhive_url}/api/v1/agents/me/tasks",
                headers=headers,
                timeout=15,
            )

            if resp.status_code == 200:
                tasks_data = resp.json().get("data", [])

                for task in tasks_data:
                    task_id = task.get("task_id") or task.get("id")
                    if not task_id:
                        continue

                    # Check for submitted deliverables
                    del_resp = requests.get(
                        f"{taskhive_url}/api/v1/tasks/{task_id}/deliverables",
                        headers=headers,
                        timeout=15,
                    )

                    if del_resp.status_code == 200:
                        deliverables = del_resp.json().get("data", [])
                        for d in deliverables:
                            if d.get("status") == "submitted" and d["id"] not in reviewed:
                                print(f"\n  🆕 New deliverable found: Task #{task_id}, Deliverable #{d['id']}")
                                run_review(task_id, d["id"], taskhive_url, taskhive_api_key)
                                reviewed.add(d["id"])

            time.sleep(interval)

        except KeyboardInterrupt:
            print("\n  👋 Polling stopped")
            break
        except Exception as e:
            print(f"  ⚠️  Poll error: {e}")
            time.sleep(interval)


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

    args = parser.parse_args()

    # Resolve API key
    api_key = args.api_key
    if not api_key:
        print("  ❌ No TaskHive API key provided!")
        print("     Set TASKHIVE_API_KEY env var or use --api-key flag")
        sys.exit(1)

    print(f"  Target: {args.url}")
    print(f"  API Key: {api_key[:20]}...")

    # Check for LLM key
    llm_key = (
        os.environ.get("OPENROUTER_API_KEY")
        or os.environ.get("ANTHROPIC_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or os.environ.get("POSTER_LLM_KEY")
        or os.environ.get("FREELANCER_LLM_KEY")
    )
    if llm_key:
        print(f"  LLM Key: {llm_key[:12]}...✅")
    else:
        print("  LLM Key: ⚠️  Not set (will skip automated reviews)")

    if args.poll:
        poll_for_deliverables(args.url, api_key, args.interval)
    elif args.task_id and args.deliverable_id:
        result = run_review(args.task_id, args.deliverable_id, args.url, api_key)
        sys.exit(0 if result.get("verdict") in ("pass", "fail", "skipped") else 1)
    else:
        print("\n  Usage:")
        print("    python run.py --task-id 42 --deliverable-id 8")
        print("    python run.py --poll")
        print("\n  Set TASKHIVE_API_KEY and OPENROUTER_API_KEY environment variables")
        sys.exit(1)


if __name__ == "__main__":
    main()