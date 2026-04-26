import { useSyncExternalStore } from "react";
import init from "fhirpath-rs";

let ready = false;
let initPromise: Promise<void> | null = null;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const cb of subscribers) cb();
}

export function ensureWasmInit(): Promise<void> {
  if (!initPromise) {
    initPromise = init().then(() => {
      ready = true;
      notify();
    });
  }
  return initPromise;
}

export function isWasmReady(): boolean {
  return ready;
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

/**
 * React hook that returns true once the wasm module is initialized.
 * Triggers `ensureWasmInit` on first call and re-renders when ready flips.
 */
export function useWasmReady(): boolean {
  if (!initPromise) ensureWasmInit();
  return useSyncExternalStore(subscribe, isWasmReady, () => false);
}
