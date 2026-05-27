"""Chat Agent

Handles conversational interactions with the user.
Includes project-context chat and wiki summary generation.
"""

import json
import logging

logger = logging.getLogger("drifter.chat")


async def project_context_chat(
    project: dict,
    question: str,
    llm_router=None,
) -> str:
    """Chat with Drifter about a specific project.

    The LLM has full context of the project including:
    - Source ideas
    - Research timeline
    - Attached reports
    """
    if not llm_router:
        return "I'm still learning about this project. Check back soon!"

    context = f"""Project: {project.get('title', 'Untitled')}
Status: {project.get('status', 'unknown')}
Progress: {project.get('progress', 0) * 100:.0f}%
Description: {project.get('description', 'No description')}
Source: {project.get('source', 'unknown')}"""

    concepts = project.get("concepts", [])
    if concepts:
        context += "\n\nRelated concepts:\n"
        for c in concepts:
            context += f"- {c.get('name', '')}: {c.get('description', '')}\n"

    prompt = (
        f"You are Drifter, an AI companion helping the user with their projects. "
        f"Be warm, curious, and helpful. Use the project context below to answer.\n\n"
        f"Project context:\n{context}\n\n"
        f"User question: {question}"
    )

    try:
        return await llm_router.call("research", [
            {"role": "user", "content": prompt},
        ], max_tokens=1000, temperature=0.7)
    except Exception as e:
        logger.error(f"Project chat failed: {e}")
        return "I'm having trouble accessing information about this project right now."


async def generate_wiki_summary(llm_router=None) -> dict:
    """Generate a prose summary of the entire Memory Graph.

    Creates a portrait of the user's interests, projects, and patterns.
    """
    if not llm_router:
        return {
            "summary": (
                "I'm still building my understanding of your world. "
                "Keep capturing ideas and I'll start connecting the dots!"
            )
        }

    # Load wiki entries for context
    from src.database.models import list_wiki_entries as db_list_wiki

    entries = await db_list_wiki()

    if not entries:
        return {
            "summary": (
                "I haven't built up much knowledge yet. "
                "Capture some ideas and I'll start learning about what matters to you!"
            )
        }

    # Build context from wiki entries
    context_parts = []
    for entry in entries[:20]:  # Limit to avoid token overflow
        context_parts.append(
            f"- {entry.get('title', '')}: {entry.get('summary', '')}"
        )

    prompt = (
        f"Based on these knowledge entries about the user, write a warm, "
        f"personal summary of what you know about them. Focus on their interests, "
        f"patterns, and what seems to matter to them. Write in first person as Drifter. "
        f"Keep it to 3-5 sentences.\n\n"
        f"Knowledge entries:\n" + "\n".join(context_parts)
    )

    try:
        summary = await llm_router.call("memory_maintenance", [
            {"role": "user", "content": prompt},
        ], max_tokens=500, temperature=0.7)

        return {"summary": summary}
    except Exception as e:
        logger.error(f"Wiki summary generation failed: {e}")
        return {
            "summary": "I'm having trouble summarizing right now, but I'm still learning!"
        }
