"""LangGraph graph definition for the Reviewer Agent."""

from langgraph.graph import StateGraph, END

from state import ReviewerState
from nodes.read_task import read_task
from nodes.fetch_deliverable import fetch_deliverable
from nodes.resolve_api_key import resolve_api_key
from nodes.analyze_content import analyze_content
from nodes.browse_url import browse_url
from nodes.generate_verdict import generate_verdict
from nodes.complete_task import complete_task


def should_continue_after_fetch(state: ReviewerState) -> str:
    """Route after fetching deliverable -- abort on error."""
    if state.get("error"):
        return "abort"
    return "resolve_key"


def should_analyze_or_skip(state: ReviewerState) -> str:
    """Route after key resolution -- skip if no key available."""
    if state.get("error"):
        return "abort"
    if state.get("key_source") == "none":
        return "skip_review"
    return "analyze"


def should_complete_or_revise(state: ReviewerState) -> str:
    """Route after verdict -- complete on PASS, revise on FAIL, skip otherwise."""
    if state.get("error"):
        return "abort"
    verdict = state.get("verdict")
    if verdict == "pass":
        return "complete"
    elif verdict == "fail":
        return "complete"  # complete_task handles FAIL -> revision request
    else:
        return "abort"  # skipped


def abort_node(state: ReviewerState) -> dict:
    """Terminal node for errors or skipped reviews."""
    error = state.get("error")
    if error:
        print(f"\n  [ABORT] {error}")
    else:
        print("\n  [SKIP] Review skipped (no LLM key available)")
    return {}


def build_graph() -> StateGraph:
    """Build and compile the reviewer agent graph."""

    graph = StateGraph(ReviewerState)

    # --- Add nodes --------------------------------------------------
    graph.add_node("read_task", read_task)
    graph.add_node("fetch_deliverable", fetch_deliverable)
    graph.add_node("resolve_api_key", resolve_api_key)
    graph.add_node("analyze_content", analyze_content)
    graph.add_node("browse_url", browse_url)
    graph.add_node("generate_verdict", generate_verdict)
    graph.add_node("complete_task", complete_task)
    graph.add_node("abort", abort_node)

    # --- Entry point ------------------------------------------------
    graph.set_entry_point("read_task")

    # --- Edges ------------------------------------------------------

    # read_task -> fetch_deliverable (always)
    graph.add_edge("read_task", "fetch_deliverable")

    # fetch_deliverable -> resolve_key OR abort
    graph.add_conditional_edges(
        "fetch_deliverable",
        should_continue_after_fetch,
        {
            "resolve_key": "resolve_api_key",
            "abort": "abort",
        },
    )

    # resolve_api_key -> analyze OR skip
    graph.add_conditional_edges(
        "resolve_api_key",
        should_analyze_or_skip,
        {
            "analyze": "analyze_content",
            "skip_review": "abort",
            "abort": "abort",
        },
    )

    # analyze_content -> browse_url -> generate_verdict
    graph.add_edge("analyze_content", "browse_url")
    graph.add_edge("browse_url", "generate_verdict")

    # generate_verdict -> complete OR revise OR abort
    graph.add_conditional_edges(
        "generate_verdict",
        should_complete_or_revise,
        {
            "complete": "complete_task",
            "abort": "abort",
        },
    )

    # Terminal edges
    graph.add_edge("complete_task", END)
    graph.add_edge("abort", END)

    return graph.compile()


# Export compiled graph
reviewer_graph = build_graph()
