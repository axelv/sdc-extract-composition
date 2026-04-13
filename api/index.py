"""Vercel serverless function entry point.

Thin FastAPI app that imports rendering logic from viewer/backend/
and exposes it under /api/* routes for the Vercel deployment.
"""

import sys
from pathlib import Path

# Ensure viewer/backend is on sys.path so main.py's
# `from renderer import render_composition` resolves correctly.
_backend_dir = str(Path(__file__).resolve().parent.parent / "viewer" / "backend")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from viewer.backend.main import RenderRequest, RenderResponse  # noqa: E402
from viewer.backend.renderer import render_composition  # noqa: E402

from fastapi import FastAPI  # noqa: E402

app = FastAPI()


@app.post("/api/render")
def render(request: RenderRequest) -> RenderResponse:
    html_output, errors = render_composition(
        request.composition,
        request.questionnaire_response,
    )
    return RenderResponse(html=html_output, errors=errors)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
