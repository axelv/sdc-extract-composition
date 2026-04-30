import json
import os
import tempfile
from typing import Any

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from renderer import render_composition

# Lazy-loaded AI components (require GOOGLE_API_KEY)
_google_provider = None
_generate_composition = None


def get_google_provider():
    global _google_provider
    if _google_provider is None:
        if not os.environ.get("GOOGLE_API_KEY"):
            raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
        from pydantic_ai.providers.google import GoogleProvider
        _google_provider = GoogleProvider()
    return _google_provider


def get_generate_composition():
    global _generate_composition
    if _generate_composition is None:
        if not os.environ.get("GOOGLE_API_KEY"):
            raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
        from agent import generate_composition
        _generate_composition = generate_composition
    return _generate_composition


def convert_docx_to_markdown(file_path: str) -> str:
    """Convert DOCX file to markdown text."""
    import mammoth
    with open(file_path, "rb") as f:
        result = mammoth.convert_to_markdown(f)
        return result.value


if os.environ.get("LOGFIRE_TOKEN"):
    import logfire
    logfire.configure()
    logfire.instrument_pydantic_ai()

app = FastAPI(title="SDC Composition Viewer Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RenderRequest(BaseModel):
    questionnaire_response: dict[str, Any] = Field(
        description="FHIR QuestionnaireResponse"
    )
    composition: dict[str, Any] = Field(description="FHIR Composition resource")


class RenderResponse(BaseModel):
    html: str
    errors: list[str] = []


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/render")
def render(request: RenderRequest) -> RenderResponse:
    html_output, errors = render_composition(
        request.composition,
        request.questionnaire_response,
    )
    return RenderResponse(html=html_output, errors=errors)


class AgentAction(BaseModel):
    type: str
    id: str
    parent_id: str | None = None
    title: str | None = None
    content: str | None = None
    context_expression: str | None = None


class AgentRequest(BaseModel):
    prompt: str = Field(description="Natural language description of desired composition")
    questionnaire: dict[str, Any] = Field(description="FHIR Questionnaire for context")
    composition: dict[str, Any] | None = Field(
        default=None, description="Existing composition to modify"
    )


class AgentResponse(BaseModel):
    actions: list[AgentAction] = Field(description="Actions to animate")
    composition: dict[str, Any] = Field(description="Final composition state")
    message: str | None = Field(default=None, description="Agent summary message")


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


ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "text/plain",
    "application/json",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


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
