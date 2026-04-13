import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import init from "@tiro-health/fhirpath-wasm";
import "./index.css";
import App from "./App.tsx";

init().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
