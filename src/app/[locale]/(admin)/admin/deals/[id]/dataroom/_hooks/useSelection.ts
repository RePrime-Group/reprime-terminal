'use client';

import { useCallback, useState } from 'react';

// Multi-select state for documents in the admin tree. Keyed by document id.
// Used by the bulk-action bar (Move to / Delete / Download Selected).
export function useSelection() {
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  const toggleDoc = useCallback((id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectMany = useCallback((ids: string[]) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const deselectMany = useCallback((ids: string[]) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedDocIds(new Set()), []);

  const isSelected = useCallback(
    (id: string) => selectedDocIds.has(id),
    [selectedDocIds],
  );

  return {
    selectedDocIds,
    toggleDoc,
    selectMany,
    deselectMany,
    clear,
    isSelected,
    count: selectedDocIds.size,
  };
}

export type SelectionHook = ReturnType<typeof useSelection>;
