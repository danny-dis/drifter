"""Report Engine

Generates timed reports incrementally from creation to deadline.

Process:
1. Load report from DB
2. Calculate time budget (deadline - now)
3. Schedule research cycles spread across available time
4. Compile final report: Executive Summary · Key Findings · Open Questions · Next Steps
5. Notify user (pet timer_done animation)
6. Save to Completed Projects
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger("drifter.reports")


class ReportEngine:
    """Generates timed reports with incremental research."""

    def __init__(self, llm_router=None):
        self.llm_router = llm_router

    async def generate_report(self, report_id: str):
        """Generate a report by ID.

        Runs research cycles spread across the available time budget.
        Compiles findings into a structured report.
        """
        from src.database.models import get_report as db_get_report

        report = await db_get_report(report_id)
        if not report:
            logger.error(f"Report {report_id} not found")
            return

        # Update status
        await self._update_status(report_id, "researching")

        # Calculate time budget
        deadline = datetime.fromisoformat(report["deadline"]) if report.get("deadline") else None
        now = datetime.now()

        if deadline and deadline > now:
            time_budget = (deadline - now).total_seconds()
        else:
            # No deadline or past deadline — generate immediately
            time_budget = 0

        # Determine research cycles based on depth
        depth = report.get("depth", "quick_brief")
        cycle_counts = {
            "quick_brief": 2,
            "full_research": 5,
            "deep_dive": 10,
        }
        num_cycles = cycle_counts.get(depth, 2)

        # If time budget is large, spread cycles across time
        if time_budget > 300:  # More than 5 minutes
            cycle_interval = time_budget / num_cycles
            for i in range(num_cycles):
                await self._run_research_cycle(report_id, i + 1, num_cycles)
                if i < num_cycles - 1:
                    await asyncio.sleep(cycle_interval)
        else:
            # Generate immediately
            for i in range(num_cycles):
                await self._run_research_cycle(report_id, i + 1, num_cycles)

        # Compile final report
        await self._compile_report(report_id)

        # Notify user
        await self._notify_complete(report_id)

        logger.info(f"Report generation complete: {report_id}")

    async def _run_research_cycle(self, report_id: str, cycle: int, total: int):
        """Run a single research cycle for a report."""
        from src.database.models import get_report as db_get_report

        report = await db_get_report(report_id)
        if not report:
            return

        topic = report.get("topic", "")
        progress = cycle / total

        await self._update_status(report_id, "researching")

        if self.llm_router:
            try:
                findings = await self.llm_router.call("research", [
                    {
                        "role": "system",
                        "content": (
                            f"You are researching: {topic}. "
                            f"This is cycle {cycle} of {total}. "
                            f"Provide new findings, not previously mentioned information."
                        ),
                    },
                    {"role": "user", "content": f"Research findings for cycle {cycle}:"},
                ], max_tokens=2000, temperature=0.7)

                # Append findings to report content
                from src.database.models import _get_db

                db = _get_db()
                current_content = report.get("content", "") or ""
                new_content = f"\n\n## Research Cycle {cycle}/{total}\n{findings}"
                await db.execute(
                    "UPDATE reports SET content = ? WHERE id = ?",
                    (current_content + new_content, report_id),
                )
                await db.commit()
            except Exception as e:
                logger.error(f"Research cycle {cycle} failed: {e}")

    async def _compile_report(self, report_id: str):
        """Compile the final report with executive summary and structure."""
        from src.database.models import get_report as db_get_report, _get_db

        report = await db_get_report(report_id)
        if not report:
            return

        content = report.get("content", "") or ""
        topic = report.get("topic", "")

        if self.llm_router and content:
            try:
                compiled = await self.llm_router.call("report_generation", [
                    {
                        "role": "system",
                        "content": (
                            f"Compile these research findings into a structured report. "
                            f"Include: Executive Summary, Key Findings, Open Questions, Suggested Next Steps."
                        ),
                    },
                    {"role": "user", "content": f"Topic: {topic}\n\nFindings:\n{content}"},
                ], max_tokens=4000, temperature=0.5)

                db = _get_db()
                await db.execute(
                    "UPDATE reports SET content = ?, status = 'ready' WHERE id = ?",
                    (compiled, report_id),
                )
                await db.commit()
                return
            except Exception as e:
                logger.error(f"Report compilation failed: {e}")

        # Fallback: just mark as ready
        db = _get_db()
        await db.execute(
            "UPDATE reports SET status = 'ready' WHERE id = ?",
            (report_id,),
        )
        await db.commit()

    async def _notify_complete(self, report_id: str):
        """Notify user that report is ready."""
        from src.database.models import get_report as db_get_report, _get_db
        from src.server import broadcast_event

        report = await db_get_report(report_id)
        if not report:
            return

        # Update status to delivered
        db = _get_db()
        await db.execute(
            "UPDATE reports SET status = 'delivered', delivered_at = ? WHERE id = ?",
            (datetime.now().isoformat(), report_id),
        )
        await db.commit()

        # Broadcast notification
        await broadcast_event("timer_complete", {
            "report_id": report_id,
            "topic": report.get("topic", ""),
        })

        await broadcast_event("pet_animation", {
            "state": "timer_done",
        })

    async def _update_status(self, report_id: str, status: str):
        """Update report status."""
        from src.database.models import _get_db

        db = _get_db()
        await db.execute(
            "UPDATE reports SET status = ? WHERE id = ?",
            (status, report_id),
        )
        await db.commit()
