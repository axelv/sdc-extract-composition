import { useState } from "react";
import { analyze_expression } from "fhirpath-rs";
import { useWasmQuestionnaireIndex } from "./lexical/WasmQuestionnaireIndexContext";

export function AnalyzeExpressionDebug() {
  const wasmIndex = useWasmQuestionnaireIndex();
  const [expr, setExpr] = useState("%resource.item.where(linkId='test')");
  const [result, setResult] = useState<unknown>(null);

  const testExpressions = [
    "%resource.item",
    "%resource.item.where(linkId='test')",
    "%resource.item.where(linkId='test').answer.value",
    "%resource.item.where(linkId='test').exists()",
    "%resource.item.first()",
  ];

  const runAnalyze = (expression: string) => {
    if (!wasmIndex) {
      setResult({ error: "No WasmQuestionnaireIndex available" });
      return;
    }
    try {
      // Test with expected_cardinality to detect singleton vs collection
      const resCollection = analyze_expression(expression, wasmIndex, null, null, null, "collection");
      const resSingleton = analyze_expression(expression, wasmIndex, null, null, null, "singleton");

      const isCollection = !resCollection.diagnostics?.some(
        (d: { code: string }) => d.code === "expression_cardinality_mismatch"
      );
      const isSingleton = !resSingleton.diagnostics?.some(
        (d: { code: string }) => d.code === "expression_cardinality_mismatch"
      );

      const inferredType = isCollection ? "repeating" : isSingleton ? "conditional" : "unknown";

      console.log("analyze_expression results:", { resCollection, resSingleton, inferredType });
      setResult({
        inferredType,
        isCollection,
        isSingleton,
        withCollectionExpected: resCollection,
        withSingletonExpected: resSingleton
      });
    } catch (e) {
      setResult({ error: String(e) });
    }
  };

  return (
    <div className="p-4 bg-gray-100 border rounded m-4">
      <h3 className="font-bold mb-2">analyze_expression Debug</h3>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          className="flex-1 px-2 py-1 border rounded font-mono text-sm"
        />
        <button
          onClick={() => runAnalyze(expr)}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
        >
          Analyze
        </button>
      </div>
      <div className="flex gap-1 flex-wrap mb-2">
        {testExpressions.map((e) => (
          <button
            key={e}
            onClick={() => {
              setExpr(e);
              runAnalyze(e);
            }}
            className="px-2 py-0.5 bg-gray-200 rounded text-xs font-mono hover:bg-gray-300"
          >
            {e}
          </button>
        ))}
      </div>
      {result && (
        <pre className="bg-white p-2 rounded text-xs overflow-auto max-h-64">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
