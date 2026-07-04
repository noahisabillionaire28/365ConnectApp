/**
 * Module-level reactive store for feed interaction state.
 * Keeps saved/applied/accepted/clocked-in status in sync across all screens
 * without a React context or external library.
 */
import { useEffect, useState } from 'react';

const savedIds     = new Set<string>();
const appliedIds   = new Set<string>();
const acceptedIds  = new Set<string>();
const clockedInIds = new Set<string>();
const listeners    = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function toggleSaved(id: string) {
  if (savedIds.has(id)) savedIds.delete(id); else savedIds.add(id);
  notify();
}
export function markApplied(id: string)   { appliedIds.add(id);   notify(); }
export function markAccepted(id: string)  { acceptedIds.add(id);  notify(); }
export function markClockedIn(id: string) { clockedInIds.add(id); notify(); }

export function isSaved(id: string)     { return savedIds.has(id); }
export function isApplied(id: string)   { return appliedIds.has(id); }
export function isAccepted(id: string)  { return acceptedIds.has(id); }
export function isClockedIn(id: string) { return clockedInIds.has(id); }

/** Subscribe a component to any store change. */
export function useFeedStore() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return { isSaved, isApplied, isAccepted, isClockedIn, toggleSaved, markApplied, markAccepted, markClockedIn };
}
