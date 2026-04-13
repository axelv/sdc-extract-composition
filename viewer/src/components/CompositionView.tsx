import type { Composition } from "../types";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import { FhirPathPill } from "./FhirPathPill";
import { SectionView } from "./SectionView";

interface CompositionViewProps {
  composition: Composition;
  questionnaireIndex?: QuestionnaireIndex;
  showContext?: boolean;
}

const TEMPLATE_EXTRACT_VALUE_URL =
  "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractValue";

function getDateExpression(composition: Composition): string | null {
  const ext = composition._date?.extension?.find(
    (e) => e.url === TEMPLATE_EXTRACT_VALUE_URL
  );
  if (!ext?.valueString) return null;
  const match = ext.valueString.match(/^\{\{(.*)\}\}$/);
  return match ? match[1].trim() : ext.valueString;
}

export function CompositionView({ composition, questionnaireIndex, showContext = true }: CompositionViewProps) {
  const dateExpr = getDateExpression(composition);

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-3">
        <h2 className="text-lg font-semibold text-gray-900">
          {composition.title ?? composition.id}
        </h2>
        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
          <span>Date:</span>
          {dateExpr ? (
            <FhirPathPill expression={dateExpr} />
          ) : (
            <span>{composition.date ?? "—"}</span>
          )}
        </div>
        {composition.type?.coding?.[0] && (
          <div className="text-xs text-gray-400 mt-1">
            {composition.type.coding[0].display} ({composition.type.coding[0].code})
          </div>
        )}
      </div>

      <div className="sections-gutter space-y-2">
        {composition.section?.map((section, i) => (
          <SectionView key={i} section={section} questionnaireIndex={questionnaireIndex} showContext={showContext} />
        ))}
      </div>
    </div>
  );
}
