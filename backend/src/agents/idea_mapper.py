"""Idea Mapper

Clusters ideas by semantic similarity and creates Concept Map Nodes.
Runs after every new idea capture.

Algorithm:
1. Load all raw/processing ideas with embeddings
2. Compute pairwise cosine similarity
3. Build clusters using single-linkage with threshold
4. For clusters with 2+ ideas, create a Concept Map Node
5. Link ideas to concept node
6. Trigger research sub-agent for new concepts
"""

import logging
import math
from typing import Optional

logger = logging.getLogger("drifter.idea_mapper")


class IdeaMapper:
    """Clusters ideas and creates concept map nodes."""

    SIMILARITY_THRESHOLD = 0.75

    def __init__(self, db=None, vector_store=None, sub_agent_pool=None, llm_router=None):
        self.db = db
        self.vector_store = vector_store
        self.sub_agent_pool = sub_agent_pool
        self.llm_router = llm_router

    async def process_new_idea(self, idea_id: str):
        """Process a new idea: find clusters, create concept nodes if needed."""
        logger.info(f"Idea mapping triggered for {idea_id}")

        # Load all raw/processing ideas
        ideas = await self._load_processable_ideas()
        if len(ideas) < 2:
            logger.info("Not enough ideas to cluster yet")
            return

        # Compute similarity matrix and cluster
        clusters = self._cluster_ideas(ideas)

        # For each cluster with 2+ ideas, create or update concept node
        for cluster in clusters:
            if len(cluster) < 2:
                continue

            await self._create_or_update_concept(cluster)

    async def _load_processable_ideas(self) -> list[dict]:
        """Load all ideas with status 'raw' or 'processing' that have embeddings."""
        from src.database.models import list_ideas

        all_ideas = await list_ideas(status="raw", limit=500)
        processing = await list_ideas(status="processing", limit=500)

        # Combine and filter to those with embeddings
        ideas = all_ideas + processing
        return [
            idea for idea in ideas
            if idea.get("embedding") and len(idea["embedding"]) > 0
        ]

    def _cluster_ideas(self, ideas: list[dict]) -> list[list[dict]]:
        """Cluster ideas using single-linkage with cosine similarity threshold.

        Returns a list of clusters, where each cluster is a list of ideas.
        """
        n = len(ideas)
        if n == 0:
            return []

        # Union-Find for efficient clustering
        parent = list(range(n))

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(x, y):
            px, py = find(x), find(y)
            if px != py:
                parent[px] = py

        # Compare all pairs
        for i in range(n):
            for j in range(i + 1, n):
                sim = self._cosine_similarity(
                    ideas[i].get("embedding", []),
                    ideas[j].get("embedding", []),
                )
                if sim >= self.SIMILARITY_THRESHOLD:
                    union(i, j)

        # Group by root
        clusters_map: dict[int, list[dict]] = {}
        for i in range(n):
            root = find(i)
            if root not in clusters_map:
                clusters_map[root] = []
            clusters_map[root].append(ideas[i])

        return list(clusters_map.values())

    async def _create_or_update_concept(self, cluster: list[dict]):
        """Create a concept node for a cluster of ideas, or add ideas to existing."""
        from src.database.models import list_concepts, create_concept_node

        idea_ids = [idea["id"] for idea in cluster]

        # Check if any existing concept already covers these ideas
        existing_concepts = await list_concepts()
        for concept in existing_concepts:
            if concept.get("status") == "dismissed":
                continue

            # Check if this concept already contains any of these ideas
            concept_data = await self._get_concept_with_ideas(concept["id"])
            existing_idea_ids = set(
                idea["id"] for idea in concept_data.get("linked_ideas", [])
            )

            overlap = existing_idea_ids & set(idea_ids)
            if overlap:
                # Add new ideas to existing concept
                new_ideas = set(idea_ids) - existing_idea_ids
                if new_ideas:
                    await self._add_ideas_to_concept(concept["id"], list(new_ideas))
                return

        # Create new concept node
        # Generate a name via LLM
        idea_texts = [idea["raw"] for idea in cluster[:5]]  # Use first 5 for naming
        name = await self._generate_concept_name(idea_texts)

        concept = await create_concept_node(
            name=name,
            description=f"Cluster of {len(cluster)} related ideas",
            idea_ids=idea_ids,
        )

        logger.info(f"Created concept node: {name} ({concept['id']})")

        # Trigger research sub-agent
        if self.sub_agent_pool:
            await self.sub_agent_pool.spawn_research(concept["id"])

    async def _get_concept_with_ideas(self, concept_id: str) -> dict:
        """Get a concept with its linked ideas."""
        from src.database.models import get_concept

        return await get_concept(concept_id) or {}

    async def _add_ideas_to_concept(self, concept_id: str, idea_ids: list[str]):
        """Add ideas to an existing concept node."""
        import aiosqlite
        from src.database.models import _get_db

        db = _get_db()
        for idea_id in idea_ids:
            await db.execute(
                "INSERT OR IGNORE INTO concept_idea_map (concept_id, idea_id) VALUES (?, ?)",
                (concept_id, idea_id),
            )
            await db.execute(
                "UPDATE ideas SET status = 'mapped' WHERE id = ?",
                (idea_id,),
            )
        await db.commit()
        logger.info(f"Added {len(idea_ids)} ideas to concept {concept_id}")

    async def _generate_concept_name(self, idea_texts: list[str]) -> str:
        """Generate a concept name from idea texts using LLM."""
        if not self.llm_router:
            # Fallback: use first few words of first idea
            first = idea_texts[0] if idea_texts else "Untitled"
            return first[:50]

        prompt = (
            "Given these related ideas, generate a short theme name (2-4 words) "
            "that describes what they share. Return ONLY the name, nothing else.\n\n"
            "Ideas:\n" + "\n".join(f"- {t}" for t in idea_texts)
        )

        try:
            name = await self.llm_router.call("quick_capture", [
                {"role": "user", "content": prompt},
            ], max_tokens=30, temperature=0.3)
            return name.strip().strip('"').strip("'") or "Untitled Concept"
        except Exception as e:
            logger.error(f"Failed to generate concept name: {e}")
            return idea_texts[0][:50] if idea_texts else "Untitled Concept"

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        """Compute cosine similarity between two vectors."""
        if not a or not b:
            return 0.0

        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return dot / (norm_a * norm_b)
