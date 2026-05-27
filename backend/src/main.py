"""Drifter Backend — Entry Point

Spawns the FastAPI server and manages background processes:
- Sub-agent pool
- Filesystem watchers
- Report engine
"""

import argparse
import asyncio
import logging
import os
import sys

# Add src to path so we can import modules
sys.path.insert(0, os.path.dirname(__file__))

from src.server import create_app

logger = logging.getLogger("drifter")


def setup_logging(level: str = "INFO"):
    """Configure logging for the backend."""
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def get_data_dir() -> str:
    """Get the Drifter data directory (~/.drifter or platform equivalent)."""
    if os.name == "nt":
        appdata = os.environ.get("APPDATA", os.path.expanduser("~\\AppData\\Roaming"))
        return os.path.join(appdata, "Drifter")
    return os.path.expanduser("~/.drifter")


def ensure_data_dirs():
    """Create all required data directories."""
    data_dir = get_data_dir()
    dirs = [
        data_dir,
        os.path.join(data_dir, "vectors"),
        os.path.join(data_dir, "attachments"),
        os.path.join(data_dir, "reports"),
        os.path.join(data_dir, "logs"),
        os.path.join(data_dir, "backups"),
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)
    return data_dir


def main():
    parser = argparse.ArgumentParser(description="Drifter Backend")
    parser.add_argument("--port", type=int, default=7842, help="Port to listen on")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--log-level", type=str, default="INFO", help="Logging level")
    args = parser.parse_args()

    setup_logging(args.log_level)
    data_dir = ensure_data_dirs()

    logger.info(f"Drifter backend starting on {args.host}:{args.port}")
    logger.info(f"Data directory: {data_dir}")

    app = create_app(data_dir)

    import uvicorn

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level=args.log_level.lower(),
    )


if __name__ == "__main__":
    main()
