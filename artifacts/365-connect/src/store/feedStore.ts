/**
 * Module-level reactive store for feed interaction state.
 * Keeps saved/applied status in sync between HomeScreen and ShiftDetailScreen
 * without a React context or external library.
 */
import { useEffect, useState } from 'react';

const savedIds = new Set<string>();
const appliedIds = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function toggleSaved(id: string) {
  if (savedIds.has(id)) {
    savedIds.delete(id);
  } else {
    savedIds.add(id);
  }
  notify();
}

export function markApplied(id: string) {
  appliedIds.add(id);
  notify();
}

export function isSaved(id: string) {
  return savedIds.has(id);
}

export function isApplied(id: string) {
  return appliedIds.has(id);
}

/** Subscribe a component to any store change. */
export function useFeedStore() {
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return { isSaved, isApplied, toggleSaved, markApplied };
}
