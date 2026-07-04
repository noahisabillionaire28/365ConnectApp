/**
 * Module-level store for the multi-step shift-posting flow.
 * Persists form state between Step 1 → Step 2 → Step 3.
 */

export type PostShiftDraft = {
  templateId: string;
  jobType: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  payRate: number;
  workersNeeded: number;
  dressCode: string;
  description: string;
  contactName: string;
  contactPhone: string;
};

export type SwipeResult = { workerId: string; action: 'invite' | 'pass' };

function emptyDraft(): PostShiftDraft {
  return {
    templateId: '',
    jobType: '',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    payRate: 0,
    workersNeeded: 1,
    dressCode: '',
    description: '',
    contactName: '',
    contactPhone: '',
  };
}

let draft: PostShiftDraft = emptyDraft();
let swipeResults: SwipeResult[] = [];

export function getDraft(): PostShiftDraft {
  return { ...draft };
}

export function setDraft(updates: Partial<PostShiftDraft>) {
  draft = { ...draft, ...updates };
}

export function resetDraft() {
  draft = emptyDraft();
  swipeResults = [];
}

export function getSwipeResults(): SwipeResult[] {
  return [...swipeResults];
}

export function addSwipeResult(result: SwipeResult) {
  swipeResults = [...swipeResults, result];
}
