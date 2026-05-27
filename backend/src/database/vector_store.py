"""Vector Store — SQLite-backed

Stores embeddings directly in SQLite alongside the main database.
Uses cosine similarity for search — no external vector database needed.

This is simpler and more reliable than LanceDB for the initial launch.
LanceDB can be added later as an optional optimization.
"""

import json
import logging
import math
from datetime import datetime
from typing import Optional

import aiosqlite

logger = logging.getLogger("drifter.vectors")


class VectorStore:
    """SQLite-backed vector store for semantic search.

    Stores embeddings in a dedicated table and uses pure-Python cosine
    similarity for search. No external dependencies beyond SQLite.
    """

    def __init__(self, db_path: str):
        self._db_path = db_path
        self._db: Optional[aiosqlite.Connection] = None
        self._initialized = False

    async def _ensure_initialized(self):
        """Lazy initialization — create tables on first use."""
        if self._initialized:
            return

        self._db = await aiosqlite.connect(self._db_path)
        await self._db.execute("PRAGMA journal_mode=WAL")

        await self._db.executescript("""
            CREATE TABLE IF NOT EXISTS vectors (
                id TEXT NOT NULL,
                table_name TEXT NOT NULL,
                text TEXT DEFAULT '',
                vector TEXT NOT NULL,
                metadata TEXT DEFAULT '{}',
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id, table_name)
            );
            CREATE INDEX IF NOT EXISTS idx_vectors_table ON vectors(table_name);
        """)
        await self._db.commit()

        self._initialized = True
        logger.info(f"Vector store initialized at {self._db_path}")

    async def add(
        self,
        table: str,
        item_id: str,
        text: str,
        embedding: list[float],
        metadata: Optional[dict] = None,
    ):
        """Add an item to the vector store."""
        await self._ensure_initialized()

        await self._db.execute(
            """
            INSERT OR REPLACE INTO vectors (id, table_name, text, vector, metadata, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                item_id,
                table,
                text,
                json.dumps(embedding),
                json.dumps(metadata or {}),
                datetime.now().isoformat(),
            ),
        )
        await self._db.commit()

    async def search(
        self,
        table: str,
        query_embedding: list[float],
        top_k: int = 10,
    ) -> list[dict]:
        """Search for similar items using cosine similarity."""
        await self._ensure_initialized()

        async with self._db.execute(
            "SELECT id, text, vector, metadata FROM vectors WHERE table_name = ?",
            (table,),
        ) as cursor:
            rows = await cursor.fetchall()

        if not rows:
            return []

        # Compute cosine similarity for all items
        scored = []
        for item_id, text, vector_json, metadata_json in rows:
            try:
                vector = json.loads(vector_json)
                sim = self._cosine_similarity(query_embedding, vector)
                scored.append({
                    "id": item_id,
                    "text": text,
                    "metadata": json.loads(metadata_json),
                    "_distance": 1.0 - sim,  # Convert similarity to distance
                })
            except Exception:
                continue

        # Sort by similarity (highest first) and return top_k
        scored.sort(key=lambda x: x["_distance"])
        return scored[:top_k]

    async def delete(self, table: str, item_id: str):
        """Delete an item from the vector store."""
        await self._ensure_initialized()

        await self._db.execute(
            "DELETE FROM vectors WHERE id = ? AND table_name = ?",
            (item_id, table),
        )
        await self._db.commit()

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
