interface RenderedOutputPanelProps {
  html: string | null;
  errors: string[];
  loading: boolean;
}

export function RenderedOutputPanel({
  html,
  errors,
  loading,
}: RenderedOutputPanelProps) {
  return (
    <div className="panel-container">
      <div className="panel-header">
        <h2 className="panel-title">Rendered</h2>
        {loading && (
          <span className="text-xs text-gray-400 animate-pulse">
            rendering...
          </span>
        )}
      </div>
      <div className="panel-body">
        {errors.length > 0 && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {errors.map((err, i) => (
              <p key={i}>{err}</p>
            ))}
          </div>
        )}

        {html ? (
          <div
            className="narrative-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-sm text-gray-400 italic">
            Fill the questionnaire or load a QuestionnaireResponse to see the
            rendered composition.
          </p>
        )}
      </div>
    </div>
  );
}
