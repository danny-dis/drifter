"""Database Models and Schema

Defines all SQLite tables and provides async CRUD operations.
Uses aiosqlite for non-blocking database access.
"""

import json
import logging
import os
import uuid
from datetime import datetime
from typing import Optional

import aiosqlite

logger = logging.getLogger("drifter.database")

# Global connection — initialized in init_db
_db: Optional[aiosqlite.Connection] = None


def _get_db() -> aiosqlite.Connection:
    """Get the global database connection."""
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _db


async def init_db(data_dir: str):
    """Initialize the database connection and create tables if needed."""
    global _db

    db_path = os.path.join(data_dir, "memory.db")
    _db = await aiosqlite.connect(db_path)

    # Enable WAL mode for concurrent reads
    await _db.execute("PRAGMA journal_mode=WAL")
    await _db.execute("PRAGMA foreign_keys=ON")

    await _create_tables()
    await _db.commit()

    logger.info(f"Database initialized at {db_path}")


async def _create_tables():
    """Create all database tables."""
    db = _get_db()

    await db.executescript("""
        -- Ideas
        CREATE TABLE IF NOT EXISTS ideas (
            id TEXT PRIMARY KEY,
            raw TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            source TEXT CHECK(source IN ('text', 'voice', 'file', 'url')),
            attachments TEXT DEFAULT '[]',
            tags TEXT DEFAULT '[]',
            status TEXT DEFAULT 'raw' CHECK(status IN ('raw', 'processing', 'mapped', 'project', 'archived')),
            linked_ideas TEXT DEFAULT '[]',
            research_notes TEXT DEFAULT '',
            tangibility_score REAL DEFAULT 0,
            embedding TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Concept Map Nodes
        CREATE TABLE IF NOT EXISTS concept_nodes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            tangibility_score REAL DEFAULT 0,
            status TEXT DEFAULT 'thinking' CHECK(status IN ('thinking', 'researching', 'ready', 'project', 'dismissed')),
            research_notes TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Concept-to-Idea mapping
        CREATE TABLE IF NOT EXISTS concept_idea_map (
            concept_id TEXT REFERENCES concept_nodes(id) ON DELETE CASCADE,
            idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
            PRIMARY KEY (concept_id, idea_id)
        );

        -- Projects
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            status TEXT DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'waiting_research', 'review_ready', 'blocked', 'completed')),
            source TEXT DEFAULT 'user' CHECK(source IN ('user', 'agent')),
            progress REAL DEFAULT 0,
            description TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME
        );

        -- Project-to-Concept mapping
        CREATE TABLE IF NOT EXISTS project_concept_map (
            project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
            concept_id TEXT REFERENCES concept_nodes(id) ON DELETE CASCADE,
            PRIMARY KEY (project_id, concept_id)
        );

        -- Wiki Entries
        CREATE TABLE IF NOT EXISTS wiki_entries (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            summary TEXT DEFAULT '',
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_sentiment TEXT DEFAULT 'neutral' CHECK(user_sentiment IN ('excited', 'concerned', 'neutral', 'conflicted')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Wiki Facts
        CREATE TABLE IF NOT EXISTS wiki_facts (
            id TEXT PRIMARY KEY,
            wiki_entry_id TEXT REFERENCES wiki_entries(id) ON DELETE CASCADE,
            fact TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Wiki Open Questions
        CREATE TABLE IF NOT EXISTS wiki_questions (
            id TEXT PRIMARY KEY,
            wiki_entry_id TEXT REFERENCES wiki_entries(id) ON DELETE CASCADE,
            question TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Wiki Relationships
        CREATE TABLE IF NOT EXISTS wiki_relationships (
            id TEXT PRIMARY KEY,
            from_entry_id TEXT REFERENCES wiki_entries(id) ON DELETE CASCADE,
            to_entry_id TEXT REFERENCES wiki_entries(id) ON DELETE CASCADE,
            relationship TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Wiki-to-Idea mapping
        CREATE TABLE IF NOT EXISTS wiki_idea_map (
            wiki_entry_id TEXT REFERENCES wiki_entries(id) ON DELETE CASCADE,
            idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
            PRIMARY KEY (wiki_entry_id, idea_id)
        );

        -- Timed Reports
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            topic TEXT NOT NULL,
            depth TEXT CHECK(depth IN ('quick_brief', 'full_research', 'deep_dive')),
            deadline DATETIME,
            status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'researching', 'writing', 'ready', 'delivered')),
            content TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            delivered_at DATETIME
        );

        -- Connected Folders
        CREATE TABLE IF NOT EXISTS connected_folders (
            id TEXT PRIMARY KEY,
            source TEXT CHECK(source IN ('local', 'gdrive', 'onedrive', 'dropbox')),
            name TEXT NOT NULL,
            path TEXT DEFAULT '',
            enabled INTEGER DEFAULT 1,
            file_count INTEGER DEFAULT 0,
            last_synced DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Folder File Index
        CREATE TABLE IF NOT EXISTS folder_files (
            id TEXT PRIMARY KEY,
            folder_id TEXT REFERENCES connected_folders(id) ON DELETE CASCADE,
            file_path TEXT NOT NULL,
            file_type TEXT DEFAULT '',
            content TEXT DEFAULT '',
            last_modified DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- User Config (simple key-value store)
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    """)


# --- TypedDicts for request/response models ---

from typing import TypedDict


class IdeaCreate(TypedDict, total=False):
    raw: str
    source: str  # 'text' | 'voice' | 'file' | 'url'
    attachments: list[str]


class IdeaResponse(TypedDict):
    id: str
    raw: str
    timestamp: str
    source: str
    attachments: list[str]
    tags: list[str]
    status: str
    linked_ideas: list[str]
    research_notes: str
    tangibility_score: float


# --- Idea CRUD ---

async def create_idea(idea: IdeaCreate) -> IdeaResponse:
    """Create a new idea in the database."""
    db = _get_db()
    idea_id = str(uuid.uuid4())

    await db.execute(
        """
        INSERT INTO ideas (id, raw, source, attachments)
        VALUES (?, ?, ?, ?)
        """,
        (
            idea_id,
            idea["raw"],
            idea.get("source", "text"),
            json.dumps(idea.get("attachments", [])),
        ),
    )
    await db.commit()

    return await get_idea(idea_id)


async def get_idea(idea_id: str) -> Optional[IdeaResponse]:
    """Get a single idea by ID."""
    db = _get_db()
    async with db.execute("SELECT * FROM ideas WHERE id = ?", (idea_id,)) as cursor:
        row = await cursor.fetchone()

    if not row:
        return None

    return _row_to_idea(row)


async def list_ideas(
    status: str = "",
    tag: str = "",
    limit: int = 50,
    offset: int = 0,
) -> list[IdeaResponse]:
    """List ideas with optional filters."""
    db = _get_db()
    query = "SELECT * FROM ideas WHERE 1=1"
    params: list = []

    if status:
        query += " AND status = ?"
        params.append(status)

    if tag:
        query += " AND tags LIKE ?"
        params.append(f"%{tag}%")

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    async with db.execute(query, params) as cursor:
        rows = await cursor.fetchall()

    return [_row_to_idea(row) for row in rows]


async def update_idea(idea_id: str, **kwargs) -> Optional[IdeaResponse]:
    """Update an idea's fields."""
    db = _get_db()

    allowed_fields = {
        "tags", "status", "linked_ideas", "research_notes",
        "tangibility_score", "embedding",
    }
    updates = {k: v for k, v in kwargs.items() if k in allowed_fields}

    if not updates:
        return await get_idea(idea_id)

    set_clause = ", ".join(
        f"{k} = ?" for k in updates.keys()
    )
    set_clause += ", updated_at = CURRENT_TIMESTAMP"

    values = []
    for k, v in updates.items():
        if isinstance(v, list):
            values.append(json.dumps(v))
        else:
            values.append(v)

    values.append(idea_id)

    await db.execute(
        f"UPDATE ideas SET {set_clause} WHERE id = ?",
        values,
    )
    await db.commit()

    return await get_idea(idea_id)


async def delete_idea(idea_id: str):
    """Delete an idea."""
    db = _get_db()
    await db.execute("DELETE FROM ideas WHERE id = ?", (idea_id,))
    await db.commit()


def _row_to_idea(row) -> IdeaResponse:
    """Convert a database row to an IdeaResponse dict."""
    return {
        "id": row[0],
        "raw": row[1],
        "timestamp": row[2],
        "source": row[3],
        "attachments": json.loads(row[4]),
        "tags": json.loads(row[5]),
        "status": row[6],
        "linked_ideas": json.loads(row[7]),
        "research_notes": row[8],
        "tangibility_score": row[9],
    }


# --- Concept CRUD ---

async def list_concepts() -> list[dict]:
    """List all concept nodes with linked idea counts."""
    db = _get_db()
    async with db.execute("""
        SELECT c.*, COUNT(ci.idea_id) as idea_count
        FROM concept_nodes c
        LEFT JOIN concept_idea_map ci ON c.id = ci.concept_id
        GROUP BY c.id
        ORDER BY c.tangibility_score DESC
    """) as cursor:
        rows = await cursor.fetchall()

    return [
        {
            "id": row[0],
            "name": row[1],
            "description": row[2],
            "tangibility_score": row[3],
            "status": row[4],
            "research_notes": row[5],
            "created_at": row[6],
            "updated_at": row[7],
            "idea_count": row[8],
        }
        for row in rows
    ]


async def get_concept(concept_id: str) -> Optional[dict]:
    """Get a concept node with all linked ideas."""
    db = _get_db()

    async with db.execute(
        "SELECT * FROM concept_nodes WHERE id = ?", (concept_id,)
    ) as cursor:
        concept_row = await cursor.fetchone()

    if not concept_row:
        return None

    async with db.execute("""
        SELECT i.* FROM ideas i
        JOIN concept_idea_map ci ON i.id = ci.idea_id
        WHERE ci.concept_id = ?
    """, (concept_id,)) as cursor:
        idea_rows = await cursor.fetchall()

    return {
        "id": concept_row[0],
        "name": concept_row[1],
        "description": concept_row[2],
        "tangibility_score": concept_row[3],
        "status": concept_row[4],
        "research_notes": concept_row[5],
        "created_at": concept_row[6],
        "updated_at": concept_row[7],
        "linked_ideas": [_row_to_idea(r) for r in idea_rows],
    }


async def create_concept_node(
    name: str,
    description: str = "",
    idea_ids: list[str] | None = None,
) -> dict:
    """Create a new concept map node."""
    db = _get_db()
    concept_id = str(uuid.uuid4())

    await db.execute(
        """
        INSERT INTO concept_nodes (id, name, description)
        VALUES (?, ?, ?)
        """,
        (concept_id, name, description),
    )

    # Link ideas
    if idea_ids:
        for idea_id in idea_ids:
            await db.execute(
                "INSERT INTO concept_idea_map (concept_id, idea_id) VALUES (?, ?)",
                (concept_id, idea_id),
            )
            await db.execute(
                "UPDATE ideas SET status = 'mapped' WHERE id = ?",
                (idea_id,),
            )

    await db.commit()
    return await get_concept(concept_id)


# --- Project CRUD ---

async def list_projects(status: str = "") -> list[dict]:
    """List projects with optional status filter."""
    db = _get_db()
    query = "SELECT * FROM projects WHERE 1=1"
    params: list = []

    if status:
        query += " AND status = ?"
        params.append(status)

    query += " ORDER BY updated_at DESC"

    async with db.execute(query, params) as cursor:
        rows = await cursor.fetchall()

    return [
        {
            "id": row[0],
            "title": row[1],
            "status": row[2],
            "source": row[3],
            "progress": row[4],
            "description": row[5],
            "created_at": row[6],
            "updated_at": row[7],
            "completed_at": row[8],
        }
        for row in rows
    ]


async def get_project(project_id: str) -> Optional[dict]:
    """Get project detail with source concepts."""
    db = _get_db()

    async with db.execute(
        "SELECT * FROM projects WHERE id = ?", (project_id,)
    ) as cursor:
        project_row = await cursor.fetchone()

    if not project_row:
        return None

    async with db.execute("""
        SELECT c.* FROM concept_nodes c
        JOIN project_concept_map pc ON c.id = pc.concept_id
        WHERE pc.project_id = ?
    """, (project_id,)) as cursor:
        concept_rows = await cursor.fetchall()

    return {
        "id": project_row[0],
        "title": project_row[1],
        "status": project_row[2],
        "source": project_row[3],
        "progress": project_row[4],
        "description": project_row[5],
        "created_at": project_row[6],
        "updated_at": project_row[7],
        "completed_at": project_row[8],
        "concepts": [
            {
                "id": r[0],
                "name": r[1],
                "description": r[2],
                "tangibility_score": r[3],
                "status": r[4],
            }
            for r in concept_rows
        ],
    }


async def create_project_from_concept(concept_id: str) -> dict:
    """Create a project from a concept node."""
    db = _get_db()
    project_id = str(uuid.uuid4())

    # Get concept info
    async with db.execute(
        "SELECT name, description FROM concept_nodes WHERE id = ?",
        (concept_id,),
    ) as cursor:
        concept = await cursor.fetchone()

    if not concept:
        raise ValueError(f"Concept {concept_id} not found")

    await db.execute(
        """
        INSERT INTO projects (id, title, source, description)
        VALUES (?, 'agent', ?, ?)
        """,
        (project_id, concept[0], concept[1]),
    )

    # Link concept to project
    await db.execute(
        "INSERT INTO project_concept_map (project_id, concept_id) VALUES (?, ?)",
        (project_id, concept_id),
    )

    # Update concept status
    await db.execute(
        "UPDATE concept_nodes SET status = 'project' WHERE id = ?",
        (concept_id,),
    )

    await db.commit()
    return await get_project(project_id)


# --- Config ---

async def get_config() -> dict:
    """Get all config as a dict."""
    db = _get_db()
    async with db.execute("SELECT key, value FROM config") as cursor:
        rows = await cursor.fetchall()

    return {row[0]: json.loads(row[1]) for row in rows}


async def update_config(data: dict):
    """Update config entries."""
    db = _get_db()
    for key, value in data.items():
        await db.execute(
            """
            INSERT INTO config (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = ?
            """,
            (key, json.dumps(value), json.dumps(value)),
        )
    await db.commit()


async def get_companion_config() -> dict:
    """Get companion config."""
    db = _get_db()
    async with db.execute(
        "SELECT value FROM config WHERE key = 'companion'"
    ) as cursor:
        row = await cursor.fetchone()

    if not row:
        return {}
    return json.loads(row[0])


async def update_companion_config(data: dict):
    """Update companion config."""
    db = _get_db()
    await db.execute(
        """
        INSERT INTO config (key, value) VALUES ('companion', ?)
        ON CONFLICT(key) DO UPDATE SET value = ?
        """,
        (json.dumps(data), json.dumps(data)),
    )
    await db.commit()


# --- Placeholder functions for LLM calls ---
# These will be implemented in the LLM router module

async def generate_tags(raw_text: str) -> list[str]:
    """Generate semantic tags for an idea via fast LLM call."""
    from src.router.llm import LLMRouter

    router = LLMRouter()
    response = await router.call("quick_capture", [
        {"role": "system", "content": "Generate 2-5 short semantic tags for this idea. Return ONLY a JSON array of strings."},
        {"role": "user", "content": raw_text},
    ])
    try:
        return json.loads(response)
    except Exception:
        return []


async def compute_embedding(text: str) -> list[float]:
    """Compute a vector embedding for text."""
    from src.router.llm import LLMRouter

    router = LLMRouter()
    return await router.embed(text)


# --- Wiki CRUD ---

async def list_wiki_entries() -> list[dict]:
    """List all wiki entries with their facts and questions."""
    db = _get_db()
    async with db.execute("SELECT * FROM wiki_entries ORDER BY last_updated DESC") as cursor:
        rows = await cursor.fetchall()

    results = []
    for row in rows:
        entry = {
            "id": row[0],
            "title": row[1],
            "summary": row[2],
            "last_updated": row[3],
            "user_sentiment": row[4],
            "created_at": row[5],
            "facts": [],
            "open_questions": [],
        }

        async with db.execute(
            "SELECT fact FROM wiki_facts WHERE wiki_entry_id = ?", (row[0],)
        ) as c:
            entry["facts"] = [r[0] for r in await c.fetchall()]

        async with db.execute(
            "SELECT question FROM wiki_questions WHERE wiki_entry_id = ?", (row[0],)
        ) as c:
            entry["open_questions"] = [r[0] for r in await c.fetchall()]

        results.append(entry)

    return results


async def get_wiki_entry(entry_id: str) -> Optional[dict]:
    """Get a wiki entry with facts, questions, and relationships."""
    db = _get_db()

    async with db.execute(
        "SELECT * FROM wiki_entries WHERE id = ?", (entry_id,)
    ) as cursor:
        row = await cursor.fetchone()

    if not row:
        return None

    entry = {
        "id": row[0],
        "title": row[1],
        "summary": row[2],
        "last_updated": row[3],
        "user_sentiment": row[4],
        "created_at": row[5],
        "facts": [],
        "open_questions": [],
        "relationships": [],
        "source_ideas": [],
    }

    async with db.execute(
        "SELECT fact FROM wiki_facts WHERE wiki_entry_id = ?", (entry_id,)
    ) as c:
        entry["facts"] = [r[0] for r in await c.fetchall()]

    async with db.execute(
        "SELECT question FROM wiki_questions WHERE wiki_entry_id = ?", (entry_id,)
    ) as c:
        entry["open_questions"] = [r[0] for r in await c.fetchall()]

    async with db.execute(
        """
        SELECT we.title, wr.relationship
        FROM wiki_relationships wr
        JOIN wiki_entries we ON wr.to_entry_id = we.id
        WHERE wr.from_entry_id = ?
        """,
        (entry_id,),
    ) as c:
        entry["relationships"] = [
            {"title": r[0], "relationship": r[1]} for r in await c.fetchall()
        ]

    async with db.execute(
        """
        SELECT i.* FROM ideas i
        JOIN wiki_idea_map wi ON i.id = wi.idea_id
        WHERE wi.wiki_entry_id = ?
        """,
        (entry_id,),
    ) as c:
        entry["source_ideas"] = [_row_to_idea(r) for r in await c.fetchall()]

    return entry


async def update_wiki_entry(entry_id: str, data: dict) -> Optional[dict]:
    """Update a wiki entry (user corrections)."""
    db = _get_db()

    if "title" in data:
        await db.execute(
            "UPDATE wiki_entries SET title = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?",
            (data["title"], entry_id),
        )
    if "summary" in data:
        await db.execute(
            "UPDATE wiki_entries SET summary = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?",
            (data["summary"], entry_id),
        )
    if "user_sentiment" in data:
        await db.execute(
            "UPDATE wiki_entries SET user_sentiment = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?",
            (data["user_sentiment"], entry_id),
        )
    if "facts" in data:
        # Replace all facts
        await db.execute("DELETE FROM wiki_facts WHERE wiki_entry_id = ?", (entry_id,))
        for fact in data["facts"]:
            await db.execute(
                "INSERT INTO wiki_facts (id, wiki_entry_id, fact) VALUES (?, ?, ?)",
                (str(uuid.uuid4()), entry_id, fact),
            )
    if "open_questions" in data:
        await db.execute("DELETE FROM wiki_questions WHERE wiki_entry_id = ?", (entry_id,))
        for q in data["open_questions"]:
            await db.execute(
                "INSERT INTO wiki_questions (id, wiki_entry_id, question) VALUES (?, ?, ?)",
                (str(uuid.uuid4()), entry_id, q),
            )

    await db.commit()
    return await get_wiki_entry(entry_id)


# --- Reports CRUD ---

async def create_report(data: dict) -> dict:
    """Create a new timed report."""
    db = _get_db()
    report_id = str(uuid.uuid4())

    await db.execute(
        """
        INSERT INTO reports (id, topic, depth, deadline)
        VALUES (?, ?, ?, ?)
        """,
        (
            report_id,
            data.get("topic", ""),
            data.get("depth", "quick_brief"),
            data.get("deadline"),
        ),
    )
    await db.commit()

    return await get_report(report_id)


async def get_report(report_id: str) -> Optional[dict]:
    """Get report metadata."""
    db = _get_db()
    async with db.execute(
        "SELECT * FROM reports WHERE id = ?", (report_id,)
    ) as cursor:
        row = await cursor.fetchone()

    if not row:
        return None

    return {
        "id": row[0],
        "topic": row[1],
        "depth": row[2],
        "deadline": row[3],
        "status": row[4],
        "created_at": row[6],
        "delivered_at": row[7],
    }


async def get_report_content(report_id: str) -> Optional[dict]:
    """Get report content."""
    db = _get_db()
    async with db.execute(
        "SELECT content FROM reports WHERE id = ?", (report_id,)
    ) as cursor:
        row = await cursor.fetchone()

    if not row:
        return None

    return {"content": row[0]}
