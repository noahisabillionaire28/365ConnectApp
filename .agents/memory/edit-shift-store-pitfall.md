---
name: Edit shift store pitfall
description: resetDraft() clears editShiftId — must preserve it across wizard steps and explicitly clear it on cancel
---

## Rule
`resetDraft()` in `postShiftStore` now also clears `editShiftId`.  Any wizard step that calls `resetDraft()` before continuing must save and restore `editShiftId` explicitly.

## Where this matters
- `PostShiftStep1Screen.handleContinue()` calls `resetDraft()` to wipe stale wizard state, then calls `setDraft({ ... })`.  Without the save/restore, `editShiftId` would be null by the time Step 5 runs, causing it to take the INSERT path instead of UPDATE.
- The canonical fix (already applied):
  ```typescript
  const editId = getEditShiftId();   // save before resetDraft clears it
  resetDraft();
  setDraft({ ... });
  if (editId) setEditShiftId(editId); // restore
  ```

## Cancel path
When the user cancels edit by tapping Back on Step 1, call `setEditShiftId(null)` and `resetDraft()` explicitly before navigating away, so a subsequent "Post a Shift" starts a fresh INSERT:
```typescript
setEditShiftId(null);
resetDraft();
navigate(`/shift/${editId}`);
```

**Why:** `editShiftId` is module-level state in postShiftStore, not React state — it persists across navigations within the same session. Forgetting to clear it on cancel would cause the next wizard run to silently UPDATE an old row instead of creating a new one.

**How to apply:** Any code that calls `resetDraft()` mid-wizard must also handle `editShiftId` explicitly.
