import { useMemo } from "react";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import {
  segmentExpression,
  type ExpressionSegment,
} from "../utils/expression-pills";
import { useWasmReady } from "../utils/wasm-init";

interface ContextBadgeProps {
  expression: string;
  questionnaireIndex?: QuestionnaireIndex;
}

function SegmentView({
  segment,
  index,
}: {
  segment: ExpressionSegment;
  index?: QuestionnaireIndex;
}) {
  if (segment.kind === "text") {
    return <span className="expr-text">{segment.text}</span>;
  }

  if (segment.kind === "answer-pill" && index) {
    const lastLinkId = segment.linkIds[segment.linkIds.length - 1];
    const label = index.resolveItemText(lastLinkId) ?? lastLinkId;
    return (
      <span className="expr-pill answer" title={`linkId: ${segment.linkIds.join(" → ")}`}>
        {label}
      </span>
    );
  }

  if (segment.kind === "code-pill" && index) {
    const display = index.resolveCodeDisplay(segment.contextLinkId, segment.value);
    const label = display ?? segment.value.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
    return (
      <span className="expr-pill code" title={`code: ${segment.value}`}>
        {label}
      </span>
    );
  }

  return <span className="expr-text" />;
}

export function ContextBadge({ expression, questionnaireIndex }: ContextBadgeProps) {
  const wasmReady = useWasmReady();
  const segments = useMemo(
    () => (questionnaireIndex ? segmentExpression(expression) : null),
    [expression, questionnaireIndex, wasmReady]
  );

  const hasPills = segments?.some((s) => s.kind !== "text");

  if (!segments || !hasPills) {
    // Fallback: raw monospace expression
    return (
      <span className="context-badge" title={expression}>
        {expression}
      </span>
    );
  }

  return (
    <span className="context-badge-resolved" title={expression}>
      {segments.map((seg, i) => (
        <SegmentView key={i} segment={seg} index={questionnaireIndex} />
      ))}
    </span>
  );
}
