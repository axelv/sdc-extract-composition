from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from renderer import render_composition

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
