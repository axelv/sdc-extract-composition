interface RenderResult {
  html: string;
  errors: string[];
}

export async function renderComposition(
  composition: Record<string, unknown>,
  questionnaireResponse: Record<string, unknown>
): Promise<RenderResult> {
  const response = await fetch("/api/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      composition,
      questionnaire_response: questionnaireResponse,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { html: "", errors: [`Render failed: ${response.status} ${text}`] };
  }

  return response.json();
}
