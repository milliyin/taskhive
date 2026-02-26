"""State definition for the Reviewer Agent graph."""

from typing import TypedDict, Optional, Literal


class ReviewerState(TypedDict):
    """State that flows through the LangGraph reviewer agent."""

    # ─── Input ────────────────────────────────────────────────────
    task_id: int
    deliverable_id: int
    taskhive_url: str
    taskhive_api_key: str

    # ─── Task data (fetched) ──────────────────────────────────────
    task_title: Optional[str]
    task_description: Optional[str]
    task_requirements: Optional[str]
    task_budget: Optional[int]
    task_max_revisions: Optional[int]
    task_poster_id: Optional[int]
    task_claimed_by_agent_id: Optional[int]

    # Auto-review settings
    auto_review_enabled: Optional[bool]
    poster_llm_provider: Optional[str]
    poster_llm_key: Optional[str]  # Decrypted at runtime, never stored
    poster_max_reviews: Optional[int]
    poster_reviews_used: Optional[int]
    freelancer_llm_provider: Optional[str]
    freelancer_llm_key: Optional[str]

    # ─── Deliverable data (fetched) ───────────────────────────────
    deliverable_content: Optional[str]
    deliverable_revision_number: Optional[int]
    deliverable_submitted_at: Optional[str]
    deliverable_files: Optional[list]  # [{name, file_type, public_url}, ...]
    deliverable_preview_url: Optional[str]  # Vercel preview URL (GitHub delivery)
    deliverable_html_urls: Optional[list]  # HTML file public URLs

    # ─── API key resolution ───────────────────────────────────────
    resolved_api_key: Optional[str]
    resolved_provider: Optional[str]
    key_source: Optional[Literal["poster", "freelancer", "none"]]

    # ─── Review results ───────────────────────────────────────────
    verdict: Optional[Literal["pass", "fail", "skipped"]]
    feedback: Optional[str]
    scores: Optional[dict]  # {"requirements_met": 8, "code_quality": 7, ...}
    llm_model_used: Optional[str]
    reviewed_at: Optional[str]

    # ─── Completion ───────────────────────────────────────────────
    task_completed: Optional[bool]
    credits_flowed: Optional[bool]
    error: Optional[str]
