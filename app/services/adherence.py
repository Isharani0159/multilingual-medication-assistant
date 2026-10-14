"""
adherence.py
PURPOSE: Counts dose statuses and calculates the adherence percentage.
DEPENDS ON: nothing (works on the dicts built by scheduler.py)
USED BY: routers/reports.py
"""

# Statuses whose time has passed. Future doses (upcoming/due) are NOT counted.
COUNTED = ("taken", "missed", "skipped", "pending_confirmation")


def summarize(doses: list[dict]) -> dict:
    """Returns counts per status and the adherence percentage.
    Formula: patient-confirmed taken / (taken + missed + skipped + pending_confirmation).
    Unconfirmed doses are never counted as taken."""
    counts = {k: 0 for k in ("taken", "missed", "skipped", "pending_confirmation", "upcoming", "due")}
    for d in doses:
        counts[d["status"]] += 1
    counted = sum(counts[k] for k in COUNTED)
    percent = round(counts["taken"] / counted * 100) if counted else None
    return {**counts, "total_scheduled": len(doses), "counted": counted, "adherence_percent": percent}