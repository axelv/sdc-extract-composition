import { useState, useRef } from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  useHover,
  useFocus,
  useInteractions,
  useDismiss,
  FloatingPortal,
  arrow,
  FloatingArrow,
  useRole,
} from "@floating-ui/react";

interface ContextTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
}

const ARROW_FILL = "#f9f8f6";
const ARROW_STROKE = "#e0ddd6";

export function ContextTooltip({ content, children }: ContextTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const arrowRef = useRef(null);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ["top-start", "bottom-end", "right"] }),
      shift({ padding: 8 }),
      arrow({ element: arrowRef }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { delay: { open: 200, close: 100 } });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  return (
    <>
      <div ref={refs.setReference} {...getReferenceProps()} className="cond-badge-trigger">
        {children}
      </div>
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="context-tooltip"
            {...getFloatingProps()}
          >
            <FloatingArrow
              ref={arrowRef}
              context={context}
              fill={ARROW_FILL}
              stroke={ARROW_STROKE}
              strokeWidth={1}
              width={12}
              height={6}
            />
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
