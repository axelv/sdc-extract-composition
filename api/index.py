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

from viewer.backend.main import (  # noqa: E402
    RenderRequest,
    RenderResponse,
    AgentRequest,
    AgentResponse,
    AgentAction,
    get_generate_composition,
    get_google_provider,
    convert_docx_to_markdown,
    ALLOWED_MIME_TYPES,
    DOCX_MIME,
)
from viewer.backend.renderer import render_composition  # noqa: E402

import json  # noqa: E402
import tempfile  # noqa: E402
from fastapi import FastAPI, File, Form, UploadFile  # noqa: E402

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


@app.post("/api/agent/generate")
async def agent_generate(request: AgentRequest) -> AgentResponse:
    generate_composition = get_generate_composition()
    actions, composition, message = await generate_composition(
        request.prompt,
        request.questionnaire,
        request.composition,
    )
    return AgentResponse(
        actions=[AgentAction(**a) for a in actions],
        composition=composition,
        message=message,
    )


@app.post("/api/agent/generate-with-file")
async def agent_generate_with_file(
    prompt: str = Form(default=""),
    questionnaire: str = Form(...),
    composition: str = Form(default="null"),
    file: UploadFile | None = File(default=None),
) -> AgentResponse:
    questionnaire_data = json.loads(questionnaire)
    composition_data = json.loads(composition) if composition != "null" else None

    file_uri: str | None = None
    file_mime: str | None = None
    file_text: str | None = None
    has_file = False

    if file and file.filename:
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise ValueError(f"Unsupported file type: {file.content_type}")

        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        has_file = True
        if file.content_type == DOCX_MIME:
            file_text = convert_docx_to_markdown(tmp_path)
        else:
            provider = get_google_provider()
            uploaded = provider.client.files.upload(file=tmp_path)
            file_uri = uploaded.uri
            file_mime = uploaded.mime_type

    effective_prompt = prompt.strip()
    if not effective_prompt and has_file:
        effective_prompt = "Create a composition based on this document."

    generate_composition = get_generate_composition()
    actions, composition_result, message = await generate_composition(
        effective_prompt,
        questionnaire_data,
        composition_data,
        file_uri=file_uri,
        file_mime=file_mime,
        file_text=file_text,
    )
    return AgentResponse(
        actions=[AgentAction(**a) for a in actions],
        composition=composition_result,
        message=message,
    )
