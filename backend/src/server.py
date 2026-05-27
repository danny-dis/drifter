"""Drifter FastAPI Server

Provides REST API and WebSocket for the frontend.
All endpoints are versioned under /api/v1.
"""

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logger = logging.getLogger("drifter.server")

# Global WebSocket clients
ws_clients: set[WebSocket] = set()


async def broadcast_event(event_type: str, data: dict):
    """Broadcast an event to all connected WebSocket clients."""
    global ws_clients

    message = {
        "type": event_type,
        "timestamp": datetime.now().isoformat(),
        **data,
    }

    dead_clients = set()
    for client in ws_clients:
        try:
            await client.send_json(message)
        except Exception:
            dead_clients.add(client)

    ws_clients -= dead_clients


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup/shutdown lifecycle."""
    data_dir = app.state.data_dir

    # Initialize database
    logger.info("Initializing database...")
    from src.database.models import init_db

    await init_db(data_dir)

    # Initialize vector store (SQLite-backed, lazy init)
    logger.info("Initializing vector store...")
    from src.database.vector_store import VectorStore

    app.state.vector_store = VectorStore(
        db_path=os.path.join(data_dir, "memory.db")
    )

    # Initialize LLM router
    logger.info("Initializing LLM router...")
    from src.router.llm import create_router_from_env

    app.state.llm_router = create_router_from_env()

    # Initialize notification manager
    logger.info("Initializing notification manager...")
    from src.utils.notifications import NotificationManager

    app.state.notification_manager = NotificationManager()

    # Initialize sub-agent pool
    logger.info("Initializing sub-agent pool...")
    from src.agents.pool import SubAgentPool

    app.state.sub_agent_pool = SubAgentPool(
        max_concurrent=3,
        llm_router=app.state.llm_router,
        notification_manager=app.state.notification_manager,
    )

    logger.info("Backend ready")

    yield

    # Shutdown
    logger.info("Shutting down backend...")
    if app.state.sub_agent_pool:
        await app.state.sub_agent_pool.shutdown()


def create_app(data_dir: str) -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Drifter",
        description="AI companion backend",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.state.data_dir = data_dir

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routes
    register_health(app)
    register_ideas(app)
    register_concepts(app)
    register_projects(app)
    register_wiki(app)
    register_reports(app)
    register_config(app)
    register_websocket(app)

    return app


# ─── Health Check ────────────────────────────────────────────────────────


def register_health(app: FastAPI):
    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "version": "0.1.0",
        }


# ─── Ideas ───────────────────────────────────────────────────────────────


def register_ideas(app: FastAPI):
    @app.post("/api/ideas")
    async def create_idea(request: Request):
        """Capture a new idea. Triggers background tagging + embedding."""
        body = await request.json()

        from src.database.models import create_idea as db_create_idea

        result = await db_create_idea({
            "raw": body.get("raw", ""),
            "source": body.get("source", "text"),
            "attachments": body.get("attachments", []),
        })

        # Trigger background processing
        asyncio.create_task(process_new_idea(app, result["id"]))

        # Broadcast event
        await broadcast_event("idea_captured", {
            "id": result["id"],
            "raw": result["raw"],
            "timestamp": result["timestamp"],
        })

        return result

    @app.get("/api/ideas")
    async def list_ideas(
        status: str = "",
        tag: str = "",
        limit: int = 50,
        offset: int = 0,
    ):
        """List ideas with optional filters."""
        from src.database.models import list_ideas as db_list_ideas

        return await db_list_ideas(status=status, tag=tag, limit=limit, offset=offset)

    @app.get("/api/ideas/{idea_id}")
    async def get_idea(idea_id: str):
        """Get a single idea by ID."""
        from src.database.models import get_idea as db_get_idea

        idea = await db_get_idea(idea_id)
        if not idea:
            return JSONResponse(status_code=404, content={"error": "Idea not found"})
        return idea

    @app.delete("/api/ideas/{idea_id}")
    async def delete_idea(idea_id: str):
        """Delete an idea. Frontend should implement 5-second undo."""
        from src.database.models import delete_idea as db_delete_idea

        await db_delete_idea(idea_id)
        return {"ok": True}

    async def process_new_idea(app: FastAPI, idea_id: str):
        """Background task: tag, embed, and map a new idea."""
        from src.database.models import get_idea as db_get_idea, update_idea

        idea = await db_get_idea(idea_id)
        if not idea:
            return

        llm_router = app.state.llm_router
        vector_store = app.state.vector_store

        # Generate tags via fast LLM call
        tags = []
        try:
            tag_response = await llm_router.call("quick_capture", [
                {
                    "role": "system",
                    "content": (
                        "Generate 2-5 short semantic tags for this idea. "
                        "Return ONLY a JSON array of strings, nothing else."
                    ),
                },
                {"role": "user", "content": idea["raw"]},
            ], max_tokens=100, temperature=0.3)

            tag_response = tag_response.strip()
            if tag_response.startswith("```"):
                tag_response = tag_response.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            tags = json.loads(tag_response)
            if not isinstance(tags, list):
                tags = []
        except Exception as e:
            logger.error(f"Tag generation failed: {e}")

        # Compute embedding
        embedding = []
        try:
            embedding = await llm_router.embed(idea["raw"])
        except Exception as e:
            logger.error(f"Embedding failed: {e}")

        # Update idea with tags and embedding
        await update_idea(idea_id, tags=tags, embedding=embedding)

        # Store in vector store
        if vector_store and embedding:
            try:
                await vector_store.add("ideas", idea_id, idea["raw"], embedding)
            except Exception as e:
                logger.error(f"Vector store add failed: {e}")

        # Run idea mapper to find clusters
        try:
            from src.agents.idea_mapper import IdeaMapper

            mapper = IdeaMapper(
                llm_router=llm_router,
                sub_agent_pool=app.state.sub_agent_pool,
            )
            await mapper.process_new_idea(idea_id)
        except Exception as e:
            logger.error(f"Idea mapping failed: {e}")

        # Broadcast completion
        await broadcast_event("idea_processed", {
            "id": idea_id,
            "tags": tags,
        })


# ─── Concepts ────────────────────────────────────────────────────────────


def register_concepts(app: FastAPI):
    @app.get("/api/concepts")
    async def list_concepts():
        """List all concept map nodes."""
        from src.database.models import list_concepts as db_list_concepts

        return await db_list_concepts()

    @app.get("/api/concepts/{concept_id}")
    async def get_concept(concept_id: str):
        """Get a concept node with linked ideas."""
        from src.database.models import get_concept as db_get_concept

        return await db_get_concept(concept_id)

    @app.post("/api/concepts/{concept_id}/project")
    async def promote_to_project(concept_id: str):
        """Create a project from a concept node."""
        from src.database.models import create_project_from_concept

        return await create_project_from_concept(concept_id)

    @app.post("/api/concepts/{concept_id}/dismiss")
    async def dismiss_concept(concept_id: str):
        """Dismiss a concept (lower tangibility threshold)."""
        from src.database.models import _get_db

        db = _get_db()
        await db.execute(
            "UPDATE concept_nodes SET status = 'dismissed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (concept_id,),
        )
        await db.commit()
        return {"ok": True}

    @app.post("/api/concepts/{concept_id}/research")
    async def trigger_research(concept_id: str):
        """Trigger additional research for a concept."""
        pool = app.state.sub_agent_pool
        await pool.spawn_research(concept_id)
        return {"ok": True}


# ─── Projects ────────────────────────────────────────────────────────────


def register_projects(app: FastAPI):
    @app.get("/api/projects")
    async def list_projects(status: str = ""):
        """List projects with optional status filter."""
        from src.database.models import list_projects as db_list_projects

        return await db_list_projects(status=status)

    @app.get("/api/projects/{project_id}")
    async def get_project(project_id: str):
        """Get project detail with source ideas and research timeline."""
        from src.database.models import get_project as db_get_project

        return await db_get_project(project_id)

    @app.put("/api/projects/{project_id}")
    async def update_project(project_id: str, request: Request):
        """Update project status, progress, etc."""
        body = await request.json()

        import aiosqlite
        from src.database.models import _get_db

        db = _get_db()
        updates = []
        values = []

        if "status" in body:
            updates.append("status = ?")
            values.append(body["status"])
        if "progress" in body:
            updates.append("progress = ?")
            values.append(body["progress"])
        if "description" in body:
            updates.append("description = ?")
            values.append(body["description"])

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            values.append(project_id)

            await db.execute(
                f"UPDATE projects SET {', '.join(updates)} WHERE id = ?",
                values,
            )
            await db.commit()

        from src.database.models import get_project as db_get_project

        return await db_get_project(project_id)

    @app.post("/api/projects/{project_id}/ask")
    async def ask_about_project(project_id: str, request: Request):
        """Ask Drifter about a specific project (LLM with full context)."""
        body = await request.json()
        question = body.get("question", "")

        from src.database.models import get_project as db_get_project
        from src.agents.chat import project_context_chat

        project = await db_get_project(project_id)
        if not project:
            return JSONResponse(status_code=404, content={"error": "Project not found"})

        response = await project_context_chat(
            project, question, llm_router=app.state.llm_router
        )
        return {"response": response}

    @app.get("/api/projects/completed")
    async def list_completed_projects(
        date_from: str = "",
        date_to: str = "",
        origin: str = "",
        tag: str = "",
    ):
        """List completed projects with filters."""
        from src.database.models import list_projects as db_list_projects

        return await db_list_projects(status="completed")


# ─── Wiki ────────────────────────────────────────────────────────────────


def register_wiki(app: FastAPI):
    @app.get("/api/wiki")
    async def list_wiki_entries():
        """List all wiki entries."""
        from src.database.models import list_wiki_entries as db_list_wiki

        return await db_list_wiki()

    @app.get("/api/wiki/{entry_id}")
    async def get_wiki_entry(entry_id: str):
        """Get a wiki entry with facts, questions, and relationships."""
        from src.database.models import get_wiki_entry as db_get_wiki

        return await db_get_wiki(entry_id)

    @app.put("/api/wiki/{entry_id}")
    async def update_wiki_entry(entry_id: str, request: Request):
        """Edit a wiki entry (user corrections)."""
        body = await request.json()
        from src.database.models import update_wiki_entry as db_update_wiki

        return await db_update_wiki(entry_id, body)

    @app.get("/api/wiki/summary")
    async def wiki_summary():
        """Generate a prose summary of the entire Memory Graph."""
        from src.agents.chat import generate_wiki_summary

        return await generate_wiki_summary(llm_router=app.state.llm_router)


# ─── Reports ─────────────────────────────────────────────────────────────


def register_reports(app: FastAPI):
    @app.post("/api/reports")
    async def create_report(request: Request):
        """Create a timed report."""
        body = await request.json()
        from src.database.models import create_report as db_create_report

        report = await db_create_report(body)

        # Schedule report generation
        from src.utils.reports import ReportEngine

        engine = ReportEngine(llm_router=app.state.llm_router)
        asyncio.create_task(engine.generate_report(report["id"]))

        return report

    @app.get("/api/reports/{report_id}")
    async def get_report(report_id: str):
        """Get report metadata."""
        from src.database.models import get_report as db_get_report

        return await db_get_report(report_id)

    @app.get("/api/reports/{report_id}/content")
    async def get_report_content(report_id: str):
        """Get report content."""
        from src.database.models import get_report_content as db_get_content

        return await db_get_content(report_id)


# ─── Config ──────────────────────────────────────────────────────────────


def register_config(app: FastAPI):
    @app.get("/api/config")
    async def get_config():
        """Get user configuration."""
        from src.database.models import get_config as db_get_config

        return await db_get_config()

    @app.put("/api/config")
    async def update_config(request: Request):
        """Update user configuration."""
        body = await request.json()
        from src.database.models import update_config as db_update_config

        return await db_update_config(body)

    @app.get("/api/config/companion")
    async def get_companion_config():
        """Get companion config (name, character)."""
        from src.database.models import get_companion_config as db_get_companion

        return await db_get_companion()

    @app.put("/api/config/companion")
    async def update_companion_config(request: Request):
        """Update companion config."""
        body = await request.json()
        from src.database.models import update_companion_config as db_update_companion

        return await db_update_companion(body)


# ─── WebSocket ───────────────────────────────────────────────────────────


def register_websocket(app: FastAPI):
    @app.websocket("/ws")
    async def websocket_endpoint(ws: WebSocket):
        await ws.accept()
        ws_clients.add(ws)
        logger.info("WebSocket client connected")

        try:
            while True:
                # Keep connection alive
                await ws.receive_text()
        except WebSocketDisconnect:
            ws_clients.discard(ws)
            logger.info("WebSocket client disconnected")
