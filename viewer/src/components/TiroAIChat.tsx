import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import type { Composition, CompositionSection, Questionnaire, AnimationState } from "../types";
import "./tiro-ai-chat.css";

export interface TiroAIChatHandle {
  openWithPrompt: (prompt?: string) => void;
}

const THINKING_MESSAGES = [
  "Thinking...",
  "Reading questionnaire...",
  "Analyzing structure...",
  "Planning sections...",
  "Composing content...",
  "Building template...",
  "Mapping fields...",
  "Processing...",
  "Generating...",
  "Crafting sections...",
  "Evaluating options...",
  "Structuring layout...",
  "Connecting data...",
  "Reviewing items...",
  "Organizing content...",
  "Almost there...",
  "Finalizing...",
  "Adding details...",
  "Checking expressions...",
  "Wrapping up...",
];

interface AgentAction {
  type: "add" | "update" | "delete";
  id: string;
  parent_id: string | null;
  title: string | null;
  content: string | null;
  context_expression: string | null;
}

interface AgentResponse {
  actions: AgentAction[];
  composition: Composition;
  message: string | null;
}

interface TiroAIChatProps {
  questionnaire: Questionnaire;
  composition: Composition;
  onCompositionChange: (composition: Composition) => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
const TEMPLATE_EXTRACT_CONTEXT_URL =
  "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext";

function findSectionById(
  sections: CompositionSection[] | undefined,
  id: string
): CompositionSection | null {
  if (!sections) return null;
  for (const sec of sections) {
    if (sec._id === id) return sec;
    const found = findSectionById(sec.section, id);
    if (found) return found;
  }
  return null;
}

function setAnimationState(
  comp: Composition,
  sectionId: string,
  state: AnimationState | undefined
): Composition {
  const updated = structuredClone(comp);

  function walk(sections: CompositionSection[] | undefined) {
    if (!sections) return;
    for (const sec of sections) {
      if (sec._id === sectionId) {
        sec._animationState = state;
      }
      walk(sec.section);
    }
  }
  walk(updated.section);
  return updated;
}

function applyAction(comp: Composition, action: AgentAction): Composition {
  const updated = structuredClone(comp);

  if (action.type === "add") {
    const newSection: CompositionSection = {
      _id: action.id,
      _animationState: "adding",
      title: action.title || undefined,
      text: {
        status: "generated",
        div: action.content?.startsWith("<div")
          ? action.content
          : `<div xmlns="http://www.w3.org/1999/xhtml">${action.content || ""}</div>`,
      },
    };
    if (action.context_expression) {
      newSection.extension = [
        { url: TEMPLATE_EXTRACT_CONTEXT_URL, valueString: action.context_expression },
      ];
    }

    if (!action.parent_id) {
      updated.section = [...(updated.section ?? []), newSection];
    } else {
      const parent = findSectionById(updated.section, action.parent_id);
      if (parent) {
        parent.section = [...(parent.section ?? []), newSection];
      }
    }
  } else if (action.type === "update") {
    const section = findSectionById(updated.section, action.id);
    if (section) {
      section._animationState = "updating";
      if (action.title !== null) section.title = action.title || undefined;
      if (action.content !== null) {
        section.text = {
          status: "generated",
          div: action.content.startsWith("<div")
            ? action.content
            : `<div xmlns="http://www.w3.org/1999/xhtml">${action.content}</div>`,
        };
      }
      if (action.context_expression !== null) {
        if (action.context_expression) {
          section.extension = [
            { url: TEMPLATE_EXTRACT_CONTEXT_URL, valueString: action.context_expression },
          ];
        } else {
          section.extension = undefined;
        }
      }
    }
  } else if (action.type === "delete") {
    const section = findSectionById(updated.section, action.id);
    if (section) {
      section._animationState = "deleting";
    }
  }

  return updated;
}

function removeDeletedSections(comp: Composition): Composition {
  const updated = structuredClone(comp);

  function filterSections(sections: CompositionSection[] | undefined): CompositionSection[] {
    if (!sections) return [];
    return sections
      .filter((s) => s._animationState !== "deleting")
      .map((s) => ({ ...s, section: filterSections(s.section) }));
  }

  updated.section = filterSections(updated.section);
  return updated;
}

export const TiroAIChat = forwardRef<TiroAIChatHandle, TiroAIChatProps>(function TiroAIChat({
  questionnaire,
  composition,
  onCompositionChange,
}, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentMessage, setAgentMessage] = useState<string | null>(null);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [thinkingStatus, setThinkingStatus] = useState(THINKING_MESSAGES[0]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    openWithPrompt: (prompt?: string) => {
      setIsOpen(true);
      if (prompt) {
        setPendingPrompt(prompt);
      }
    },
  }));

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isLoading || currentAction) return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % THINKING_MESSAGES.length;
      setThinkingStatus(THINKING_MESSAGES[idx]);
    }, 2800);
    return () => clearInterval(interval);
  }, [isLoading, currentAction]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        chatBoxRef.current &&
        !chatBoxRef.current.contains(e.target as Node) &&
        !(e.target as Element).closest(".tiro-ai-avatar")
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);


  const playbackActions = useCallback(
    async (actions: AgentAction[], startComposition: Composition) => {
      let currentComp = startComposition;

      for (const action of actions) {
        setCurrentAction(
          action.type === "add"
            ? `Adding: ${action.title || "section"}`
            : action.type === "delete"
              ? `Removing section...`
              : `Updating: ${action.title || "section"}`
        );

        // Apply action with animation state
        currentComp = applyAction(currentComp, action);
        onCompositionChange(currentComp);

        // Wait for animation
        await new Promise((resolve) => setTimeout(resolve, 400));

        // Clear animation state (or remove deleted sections)
        if (action.type === "delete") {
          currentComp = removeDeletedSections(currentComp);
        } else {
          currentComp = setAnimationState(currentComp, action.id, undefined);
        }
        onCompositionChange(currentComp);

        // Small gap between actions
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setCurrentAction(null);
    },
    [onCompositionChange]
  );

  const handleSubmit = async (presetMessage?: string) => {
    const promptText = presetMessage ?? message;
    if ((!promptText.trim() && !selectedFile) || isLoading) return;

    setIsLoading(true);
    setError(null);
    setAgentMessage(null);

    try {
      let response: Response;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("prompt", promptText);
        formData.append("questionnaire", JSON.stringify(questionnaire));
        formData.append("composition", JSON.stringify(composition));
        formData.append("file", selectedFile);

        response = await fetch(`${BACKEND_URL}/api/agent/generate-with-file`, {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch(`${BACKEND_URL}/api/agent/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptText,
            questionnaire,
            composition,
          }),
        });
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`API error: ${response.status} - ${text}`);
      }

      const data: AgentResponse = await response.json();

      if (data.message) {
        setAgentMessage(data.message);
      }

      setMessage("");
      setSelectedFile(null);
      // Start from current composition and apply actions incrementally
      await playbackActions(data.actions, composition);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (pendingPrompt && isOpen && !isLoading) {
      handleSubmit(pendingPrompt);
      setPendingPrompt(null);
    }
  }, [pendingPrompt, isOpen, isLoading]);

  return (
    <>
      <button
        className="tiro-ai-avatar"
        onClick={() => setIsOpen(!isOpen)}
        title="Tiro AI - Help me build compositions"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
          <circle cx="8.5" cy="14.5" r="1.5" />
          <circle cx="15.5" cy="14.5" r="1.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="tiro-ai-chat-box" ref={chatBoxRef}>
          <div className="tiro-ai-header">
            <span className="tiro-ai-title">Tiro AI</span>
            <button className="tiro-ai-close" onClick={() => setIsOpen(false)}>
              &times;
            </button>
          </div>

          <div className="tiro-ai-body">
            {agentMessage && (
              <div className="tiro-ai-message tiro-ai-message-agent">
                {agentMessage}
              </div>
            )}

            {isLoading && !currentAction && (
              <div className="tiro-ai-thinking">
                <span className="tiro-ai-dots">
                  <span></span><span></span><span></span>
                </span>
                {thinkingStatus}
              </div>
            )}

            {currentAction && (
              <div className="tiro-ai-action-indicator">
                <span className="tiro-ai-spinner" />
                {currentAction}
              </div>
            )}

            {error && <div className="tiro-ai-error">{error}</div>}

            {!agentMessage && !currentAction && !error && !isLoading && (
              <div className="tiro-ai-placeholder">
                <div className="tiro-ai-intro">Kies een stijl of typ je eigen instructies:</div>
                <div className="tiro-ai-presets">
                  <button
                    className="tiro-ai-preset"
                    onClick={() => handleSubmit("Create a compact, condensed narrative with minimal text.")}
                  >
                    <span className="tiro-ai-preset-title">Compact</span>
                    <span className="tiro-ai-preset-desc">Short, condensed text</span>
                  </button>
                  <button
                    className="tiro-ai-preset"
                    onClick={() => handleSubmit("Create a structured document using bullet points for each item.")}
                  >
                    <span className="tiro-ai-preset-title">Bullets</span>
                    <span className="tiro-ai-preset-desc">Structured with bullet points</span>
                  </button>
                  <button
                    className="tiro-ai-preset"
                    onClick={() => handleSubmit("Create an elaborate, detailed narrative with full sentences.")}
                  >
                    <span className="tiro-ai-preset-title">Elaborate</span>
                    <span className="tiro-ai-preset-desc">Detailed full sentences</span>
                  </button>
                  <button
                    className="tiro-ai-preset"
                    onClick={() => handleSubmit("Create a patient-friendly document using simple, laymen's language that avoids medical jargon.")}
                  >
                    <span className="tiro-ai-preset-title">Laymen</span>
                    <span className="tiro-ai-preset-desc">Simple, patient-friendly</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="tiro-ai-input-area">
            {selectedFile && (
              <div className="tiro-ai-file-preview">
                <span className="tiro-ai-file-icon">
                  {selectedFile.type.startsWith("image/") ? "🖼️" : "📄"}
                </span>
                <span className="tiro-ai-file-name">{selectedFile.name}</span>
                <button
                  className="tiro-ai-file-remove"
                  onClick={() => setSelectedFile(null)}
                  title="Remove file"
                >
                  &times;
                </button>
              </div>
            )}
            <div className="tiro-ai-input-row">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.json,.docx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                style={{ display: "none" }}
              />
              <button
                className="tiro-ai-attach"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Attach file (PDF, image, text, JSON, DOCX)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <textarea
                ref={inputRef}
                className="tiro-ai-input"
                placeholder="Beschrijf je compositie..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                rows={2}
              />
              <button
                className="tiro-ai-send"
                onClick={() => handleSubmit()}
                disabled={isLoading || (!message.trim() && !selectedFile)}
              >
                {isLoading ? (
                  <span className="tiro-ai-spinner" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
