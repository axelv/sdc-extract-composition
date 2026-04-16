import init from "fhirpath-rs";

let initPromise: Promise<void> | null = null;

export function ensureWasmInit(): Promise<void> {
  if (!initPromise) {
    initPromise = init().then(() => {});
  }
  return initPromise;
}
