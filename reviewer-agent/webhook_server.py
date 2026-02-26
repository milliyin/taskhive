"""
Webhook listener for the TaskHive Reviewer Agent.

Listens for `deliverable.submitted` events from TaskHive and
automatically triggers a review for each new deliverable.

Usage:
    python run.py --webhook --port 8000
"""

import hmac
import hashlib
import json
import threading
from flask import Flask, request, jsonify


def create_webhook_app(
    webhook_secret: str,
    taskhive_url: str,
    taskhive_api_key: str,
    run_review_fn,
) -> Flask:
    """Create a Flask app that listens for TaskHive webhook events."""

    app = Flask(__name__)

    def verify_signature(payload: bytes, signature_header: str) -> bool:
        """Verify HMAC-SHA256 signature from TaskHive."""
        if not signature_header or not signature_header.startswith("sha256="):
            return False
        expected = hmac.new(
            webhook_secret.encode(), payload, hashlib.sha256
        ).hexdigest()
        received = signature_header.removeprefix("sha256=")
        return hmac.compare_digest(expected, received)

    @app.route("/webhook", methods=["POST"])
    def handle_webhook():
        # Verify signature
        payload = request.get_data()
        signature = request.headers.get("X-TaskHive-Signature", "")

        if not verify_signature(payload, signature):
            print("  [ERROR] Webhook signature verification failed -- rejecting")
            return jsonify({"error": "Invalid signature"}), 401

        # Parse event
        event_type = request.headers.get("X-TaskHive-Event", "")
        delivery_id = request.headers.get("X-TaskHive-Delivery", "")

        try:
            body = json.loads(payload)
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid JSON"}), 400

        data = body.get("data", {})

        print(f"\n  [WEBHOOK] Received: {event_type} (delivery: {delivery_id})")

        # Only handle deliverable.submitted
        if event_type != "deliverable.submitted":
            print(f"  [SKIP] Ignoring event: {event_type}")
            return jsonify({"status": "ignored", "event": event_type}), 200

        task_id = data.get("task_id")
        deliverable_id = data.get("deliverable_id")
        task_title = data.get("task_title", "")
        revision = data.get("revision_number", 1)

        if not task_id or not deliverable_id:
            print("  [!!] Missing task_id or deliverable_id in webhook payload")
            return jsonify({"error": "Missing required fields"}), 400

        print(f"  [NEW] Deliverable: Task #{task_id} \"{task_title}\" (revision #{revision})")

        # Run review in a background thread so we respond to the webhook quickly
        # TaskHive has a 10s timeout on webhook delivery
        def do_review():
            try:
                run_review_fn(task_id, deliverable_id, taskhive_url, taskhive_api_key)
            except Exception as e:
                print(f"  [!!] Review failed: {e}")

        thread = threading.Thread(target=do_review, daemon=True)
        thread.start()

        return jsonify({
            "status": "accepted",
            "task_id": task_id,
            "deliverable_id": deliverable_id,
        }), 200

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "mode": "webhook"}), 200

    return app
