/**
 * Browser-side SSE event bus.
 *
 * A single EventTarget that all hooks subscribe to. The useSSE hook feeds it;
 * hooks like useMessages and useNotifications listen to specific event names.
 */
export const sseEmitter = new EventTarget();

/** Typed helper to fire an event on the shared emitter. */
export function emitSSE<T>(name: string, detail: T): void {
  sseEmitter.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Typed helper to subscribe + auto-cleanup on unmount. */
export function onSSE<T>(
  name: string,
  handler: (detail: T) => void,
): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<T>).detail);
  sseEmitter.addEventListener(name, listener);
  return () => sseEmitter.removeEventListener(name, listener);
}
