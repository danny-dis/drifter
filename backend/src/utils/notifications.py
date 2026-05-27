"""Notification Manager

Manages proactive notifications with cooldown logic.
Ensures notifications are never pushed more than once per hour per concept.
"""

import logging
import time
from typing import Optional

logger = logging.getLogger("driffer.notifications")


class NotificationManager:
    """Manages proactive notifications with cooldown."""

    def __init__(self, cooldown_seconds: int = 3600):
        self.cooldown_seconds = cooldown_seconds
        self._last_notification: dict[str, float] = {}

    async def notify_if_ready(
        self,
        concept_id: str,
        concept_name: str,
        score: float,
        threshold: float = 0.72,
    ) -> bool:
        """Send a notification if concept is ready and not in cooldown.

        Returns True if notification was sent.
        """
        if score < threshold:
            return False

        if self._is_in_cooldown(concept_id):
            return False

        self._last_notification[concept_id] = time.time()

        # Broadcast via WebSocket
        from src.server import broadcast_event

        await broadcast_event("tangibility_threshold", {
            "concept_id": concept_id,
            "concept_name": concept_name,
            "score": score,
            "message": (
                f"I've been thinking about {concept_name}. "
                f"Here's what I found. Want to turn this into a project?"
            ),
        })

        await broadcast_event("pet_animation", {
            "state": "has_news",
        })

        logger.info(f"Notification sent for concept: {concept_name}")
        return True

    def _is_in_cooldown(self, concept_id: str) -> bool:
        """Check if a concept notification is in cooldown."""
        last_time = self._last_notification.get(concept_id, 0)
        return (time.time() - last_time) < self.cooldown_seconds
