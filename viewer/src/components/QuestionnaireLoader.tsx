import { useEffect, useRef, useState } from "react";
import type { Questionnaire } from "../types";

const iterationModules = import.meta.glob(
  "../iterations/*/questionnaire-extract.json",
  { eager: true, import: "default" }
) as Record<string, Questionnaire>;

// Build a map of iteration name → Questionnaire
const iterations = Object.entries(iterationModules)
  .map(([path, data]) => {
    const name = path.split("/").at(-2) ?? path;
    return { name, data };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

/** Get iteration name from URL ?iteration= parameter */
function getIterationFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("iteration");
}

/** Find a matching iteration by name (exact or partial match) */
function findIteration(name: string) {
  return (
    iterations.find((it) => it.name === name) ??
    iterations.find((it) => it.name.includes(name))
  );
}

/** Default iteration when none specified */
const DEFAULT_ITERATION = "demo-example";

interface QuestionnaireLoaderProps {
  onLoad: (questionnaire: Questionnaire) => void;
}

function IterationDropdown({
  onSelect,
  initialSelection,
}: {
  onSelect: (q: Questionnaire) => void;
  initialSelection?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(initialSelection ?? null);
  const ref = useRef<HTMLDivElement>(null);

  // Sync when initialSelection arrives asynchronously
  useEffect(() => {
    if (initialSelection && !selected) {
      setSelected(initialSelection);
    }
  }, [initialSelection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white hover:bg-gray-50 min-w-[200px] text-left flex items-center justify-between gap-2"
      >
        <span className={selected ? "text-gray-900" : "text-gray-400"}>
          {selected ?? "Select iteration…"}
        </span>
        <svg
          className="w-3 h-3 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg py-1 text-sm max-h-60 overflow-auto">
          {iterations.map((it) => (
            <li key={it.name}>
              <button
                onClick={() => {
                  setSelected(it.name);
                  setOpen(false);
                  onSelect(it.data);
                }}
                className={`w-full text-left px-3 py-1.5 hover:bg-gray-100 ${
                  selected === it.name
                    ? "text-blue-700 font-medium"
                    : "text-gray-700"
                }`}
              >
                {it.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function QuestionnaireLoader({ onLoad }: QuestionnaireLoaderProps) {
  const [initialSelection, setInitialSelection] = useState<string>();

  // Auto-load from URL param or default on mount
  useEffect(() => {
    const urlIteration = getIterationFromUrl();
    const target = urlIteration ?? DEFAULT_ITERATION;
    const match = findIteration(target);
    if (match) {
      setInitialSelection(match.name);
      onLoad(match.data);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center gap-3">
      <IterationDropdown onSelect={onLoad} initialSelection={initialSelection} />
    </div>
  );
}
