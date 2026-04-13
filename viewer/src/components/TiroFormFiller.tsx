import { useEffect, useRef } from "react";
import type { Questionnaire } from "../types";

interface TiroFormFillerProps {
  questionnaire: Questionnaire;
  onResponse: (qr: Record<string, unknown>) => void;
}

export function TiroFormFiller({
  questionnaire,
  onResponse,
}: TiroFormFillerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onResponseRef = useRef(onResponse);
  onResponseRef.current = onResponse;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous instance
    container.innerHTML = "";

    // Create the custom element
    const filler = document.createElement("tiro-form-filler");

    // Inject questionnaire JSON via script slot
    const script = document.createElement("script");
    script.type = "application/fhir+json";
    script.slot = "questionnaire";
    script.textContent = JSON.stringify(questionnaire);
    filler.appendChild(script);

    // Clone-and-replace pattern to force web component re-render
    container.appendChild(filler);
    const cloned = filler.cloneNode(false) as HTMLElement;
    cloned.appendChild(script.cloneNode(true));
    container.replaceChild(cloned, filler);

    // Listen for form updates
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.response) {
        onResponseRef.current(detail.response);
      }
    };
    cloned.addEventListener("tiro-update", handleUpdate);

    return () => {
      cloned.removeEventListener("tiro-update", handleUpdate);
      container.innerHTML = "";
    };
  }, [questionnaire]);

  return <div ref={containerRef} className="tiro-form-filler-container" />;
}
