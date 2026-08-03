/**
 * Module-level reactive store for feed interaction state.
 * Keeps saved/clocked-in status in sync across all screens without a React
 * context or external library.
 *
 * Saved shift IDs are persisted to localStorage keyed by user id so they
 * survive page reloads. Call hydrateForUser(userId) after sign-in and
 * clearUser() on sign-out.
 *
 * Application status (applied/pending/accepted/declined) is NOT tracked here
 * — it lives in Supabase (`applications` table) and is read via
 * `useApplications` / `useApplicationStatus` / `useMyApplications`, since it
 * must survive reloads and be visible to both the worker and the client.
 */
import { useEffect, useState } from 'react';

const savedIds     = new Set<string>();
const clockedInIds = new Set<string>();
const listeners    = new Set<() => void>();
let _userId: string | null = null;

function storageKey(uid: string) { return `365connect:saved:${uid}`; }

function persist() {
  if (!_userId) return;
  try {
    localStorage.setItem(storageKey(_userId), JSON.stringify([...savedIds]));
  } catch { /* ignore quota/private-browsing errors */ }
}

function notify() {
  listeners.forEach((l) => l());
}

/** Load saved IDs from localStorage for the given user. Call after sign-in. */
export function hydrateForUser(userId: string) {
  _userId = userId;
  savedIds.clear();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) {
      const ids = JSON.parse(raw) as string[];
      ids.forEach((id) => savedIds.add(id));
    }
  } catch { /* corrupt data — start fresh */ }
  notify();
}

/** Clear in-memory saved state. Call on sign-out. */
export function clearUser() {
  _userId = null;
  savedIds.clear();
  notify();
}

export function toggleSaved(id: string) {
  if (savedIds.has(id)) savedIds.delete(id); else savedIds.add(id);
  persist();
  notify();
}
export function markClockedIn(id: string) { clockedInIds.add(id); notify(); }

export function isSaved(id: string)     { return savedIds.has(id); }
export function isClockedIn(id: string) { return clockedInIds.has(id); }

/** Subscribe a component to any store change. */
export function useFeedStore() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return { isSaved, isClockedIn, toggleSaved, markClockedIn };
}
