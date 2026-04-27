interface AddBetweenButtonProps {
  onClick: () => void;
}

export function AddBetweenButton({ onClick }: AddBetweenButtonProps) {
  return (
    <div className="editor-add-between">
      <button
        className="editor-add-btn"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        title="Add section"
      >
        <svg viewBox="0 0 12 12" fill="none" strokeWidth="2">
          <line x1="6" y1="1" x2="6" y2="11" />
          <line x1="1" y1="6" x2="11" y2="6" />
        </svg>
      </button>
    </div>
  );
}
