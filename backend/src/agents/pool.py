"""Sub-Agent Pool

Manages concurrent research sub-agents.
Each sub-agent researches a concept node asynchronously.
Concurrency is limited by a semaphore.

Research loop:
1. Load concept + linked ideas
2. Generate search queries from concept
3. Run web searches (OpenAI web search or fallback)
4. Summarize findings
5. Run tangibility scorer
6. Update concept in DB
7. Broadcast updates via WebSocket
"""

import asyncio
import json
import logging
import time
from typing import Optional

logger = logging.getLogger("drifter.agents")


class SubAgentPool:
    """Pool of research sub-agents with concurrency limiting."""

    def __init__(
        self,
        max_concurrent: int = 3,
        llm_router=None,
        notification_manager=None,
    ):
        self.max_concurrent = max_concurrent
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._active_tasks: dict[str, asyncio.Task] = {}
        self._shutdown = False
        self.llm_router = llm_router
        self.notification_manager = notification_manager

    async def spawn_research(self, concept_id: str) -> asyncio.Task:
        """Spawn a research task for a concept node."""
        if concept_id in self._active_tasks:
            logger.info(f"Research already active for concept {concept_id}")
            return self._active_tasks[concept_id]

        task = asyncio.create_task(self._research_concept(concept_id))
        self._active_tasks[concept_id] = task

        task.add_done_callback(
            lambda t: self._active_tasks.pop(concept_id, None)
        )

        return task

    async def _research_concept(self, concept_id: str):
        """Research a single concept node."""
        async with self._semaphore:
            if self._shutdown:
                return

            logger.info(f"Starting research for concept {concept_id}")

            try:
                # Update status to researching
                await self._update_concept_status(concept_id, "researching")
                await self._broadcast("research_update", {
                    "concept_id": concept_id,
                    "status": "researching",
                    "progress": 0,
                })

                # Load concept data
                concept = await self._get_concept(concept_id)
                if not concept:
                    logger.error(f"Concept {concept_id} not found")
                    return

                # Generate search queries
                queries = await self._generate_queries(concept)
                logger.info(f"Generated {len(queries)} search queries for {concept['name']}")

                await self._broadcast("research_update", {
                    "concept_id": concept_id,
                    "status": "researching",
                    "progress": 0.2,
                    "queries": queries,
                })

                # Run searches and collect findings
                findings = []
                for i, query in enumerate(queries):
                    if self._shutdown:
                        break
                    result = await self._web_search(query)
                    if result:
                        findings.append(result)
                    progress = 0.2 + (0.5 * (i + 1) / len(queries))
                    await self._broadcast("research_update", {
                        "concept_id": concept_id,
                        "status": "researching",
                        "progress": progress,
                    })

                # Summarize findings
                summary = await self._summarize_findings(concept, findings)
                logger.info(f"Research summary complete for {concept['name']}")

                await self._broadcast("research_update", {
                    "concept_id": concept_id,
                    "status": "researching",
                    "progress": 0.8,
                })

                # Run tangibility scorer
                score = await self._score_tangibility(concept, findings)
                logger.info(f"Tangibility score for {concept['name']}: {score:.2f}")

                # Update concept with research notes and score
                await self._update_concept(
                    concept_id,
                    research_notes=summary,
                    tangibility_score=score,
                )

                # Determine status
                if score >= 0.72:
                    await self._update_concept_status(concept_id, "ready")
                    # Trigger notification
                    if self.notification_manager:
                        await self.notification_manager.notify_if_ready(
                            concept_id, concept["name"], score
                        )
                else:
                    await self._update_concept_status(concept_id, "thinking")

                await self._broadcast("research_update", {
                    "concept_id": concept_id,
                    "status": "ready" if score >= 0.72 else "thinking",
                    "progress": 1.0,
                    "score": score,
                })

                logger.info(f"Research complete for concept {concept_id}")

            except Exception as e:
                logger.error(f"Research failed for concept {concept_id}: {e}")
                await self._update_concept_status(concept_id, "thinking")
                await self._broadcast("research_update", {
                    "concept_id": concept_id,
                    "status": "error",
                    "error": str(e),
                })

    async def _get_concept(self, concept_id: str) -> Optional[dict]:
        """Load concept data from database."""
        from src.database.models import get_concept

        return await get_concept(concept_id)

    async def _update_concept_status(self, concept_id: str, status: str):
        """Update concept status in database."""
        import aiosqlite
        from src.database.models import _get_db

        db = _get_db()
        await db.execute(
            "UPDATE concept_nodes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (status, concept_id),
        )
        await db.commit()

    async def _update_concept(
        self,
        concept_id: str,
        research_notes: str = "",
        tangibility_score: float = 0,
    ):
        """Update concept research notes and tangibility score."""
        import aiosqlite
        from src.database.models import _get_db

        db = _get_db()
        await db.execute(
            """
            UPDATE concept_nodes
            SET research_notes = ?, tangibility_score = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (research_notes, tangibility_score, concept_id),
        )
        await db.commit()

    async def _generate_queries(self, concept: dict) -> list[str]:
        """Generate search queries from a concept."""
        if not self.llm_router:
            # Fallback: use concept name as query
            return [concept.get("name", "")]

        linked_ideas = concept.get("linked_ideas", [])
        idea_texts = "\n".join(
            f"- {idea.get('raw', '')}" for idea in linked_ideas[:5]
        )

        prompt = (
            f"Given this concept and related ideas, generate 3 specific web search queries "
            f"to research it. Return ONLY a JSON array of 3 strings.\n\n"
            f"Concept: {concept.get('name', '')}\n"
            f"Ideas:\n{idea_texts}"
        )

        try:
            response = await self.llm_router.call("research", [
                {"role": "user", "content": prompt},
            ], max_tokens=200, temperature=0.3)

            # Parse JSON array
            response = response.strip()
            if response.startswith("```"):
                response = response.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            queries = json.loads(response)
            if isinstance(queries, list) and queries:
                return queries[:3]
        except Exception as e:
            logger.error(f"Failed to generate queries: {e}")

        return [concept.get("name", "")]

    async def _web_search(self, query: str) -> Optional[str]:
        """Run a web search and return results."""
        if not self.llm_router:
            return None

        try:
            # Use OpenAI's web search capability via chat with system prompt
            response = await self.llm_router.call("research", [
                {
                    "role": "system",
                    "content": (
                        "You are a research assistant. Search for information about the given query. "
                        "Provide a concise summary of key findings, including relevant facts, "
                        "existing solutions, and open questions. Format as bullet points."
                    ),
                },
                {"role": "user", "content": f"Research: {query}"},
            ], max_tokens=2000, temperature=0.5)

            return response
        except Exception as e:
            logger.error(f"Web search failed for '{query}': {e}")
            return None

    async def _summarize_findings(
        self, concept: dict, findings: list[str]
    ) -> str:
        """Summarize research findings into a coherent report."""
        if not findings:
            return "No research findings available."

        if not self.llm_router:
            return "\n\n".join(findings)

        findings_text = "\n\n---\n\n".join(findings)

        prompt = (
            f"Summarize these research findings about '{concept.get('name', '')}' "
            f"into a concise report with:\n"
            f"- Key findings\n"
            f"- Existing solutions or related work\n"
            f"- Open questions\n\n"
            f"Research:\n{findings_text}"
        )

        try:
            return await self.llm_router.call("research", [
                {"role": "user", "content": prompt},
            ], max_tokens=3000, temperature=0.5)
        except Exception as e:
            logger.error(f"Failed to summarize findings: {e}")
            return findings_text

    async def _score_tangibility(
        self, concept: dict, findings: list[str]
    ) -> float:
        """Score concept tangibility on 4 dimensions (0-1 each).

        Dimensions:
        - Specificity: How well-defined is the idea?
        - Novelty: How unique/interesting is it?
        - Feasibility: Could the user realistically pursue this?
        - User Energy: How many related ideas have they captured?
        """
        if not self.llm_router:
            # Default score based on number of linked ideas
            idea_count = len(concept.get("linked_ideas", []))
            return min(1.0, idea_count * 0.15)

        prompt = (
            f"Rate this concept on 4 dimensions (0-1 each):\n"
            f"1. Specificity: How well-defined is the idea?\n"
            f"2. Novelty: How unique/interesting is it?\n"
            f"3. Feasibility: Could the user realistically pursue this?\n"
            f"4. User Energy: How many related ideas have they captured?\n\n"
            f"Concept: {concept.get('name', '')}\n"
            f"Description: {concept.get('description', '')}\n"
            f"Linked ideas: {len(concept.get('linked_ideas', []))}\n"
            f"Research notes: {concept.get('research_notes', '')[:500]}\n\n"
            f"Return ONLY a JSON object with keys: specificity, novelty, feasibility, user_energy. "
            f"Each value is a number between 0 and 1."
        )

        try:
            response = await self.llm_router.call("quick_capture", [
                {"role": "user", "content": prompt},
            ], max_tokens=100, temperature=0.3)

            response = response.strip()
            if response.startswith("```"):
                response = response.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            scores = json.loads(response)
            specificity = float(scores.get("specificity", 0.5))
            novelty = float(scores.get("novelty", 0.5))
            feasibility = float(scores.get("feasibility", 0.5))
            user_energy = float(scores.get("user_energy", 0.5))

            # Weighted average
            return (
                specificity * 0.2
                + novelty * 0.2
                + feasibility * 0.3
                + user_energy * 0.3
            )
        except Exception as e:
            logger.error(f"Failed to score tangibility: {e}")
            return 0.5

    async def _broadcast(self, event_type: str, data: dict):
        """Broadcast an event to WebSocket clients."""
        try:
            from src.server import broadcast_event

            await broadcast_event(event_type, data)
        except Exception as e:
            logger.debug(f"Failed to broadcast event: {e}")

    async def shutdown(self):
        """Shut down all active sub-agents."""
        self._shutdown = True

        for task in self._active_tasks.values():
            task.cancel()

        if self._active_tasks:
            await asyncio.gather(
                *self._active_tasks.values(), return_exceptions=True
            )

        self._active_tasks.clear()
        logger.info("Sub-agent pool shut down")

    @property
    def active_count(self) -> int:
        """Number of currently running sub-agents."""
        return len(self._active_tasks)
