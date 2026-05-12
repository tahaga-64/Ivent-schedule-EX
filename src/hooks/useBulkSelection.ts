import { useState, useCallback, useMemo } from 'react';

export interface UseBulkSelectionReturn {
  selectedIds: string[];
  isSelected: (id: string) => boolean;
  isAllSelected: (ids: string[]) => boolean;
  isPartiallySelected: (ids: string[]) => boolean;
  toggleSelection: (id: string) => void;
  toggleAllSelection: (ids: string[]) => void;
  clearSelection: () => void;
  selectMultiple: (ids: string[]) => void;
  selectedCount: number;
}

export function useBulkSelection(): UseBulkSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const isSelected = useCallback((id: string) => {
    return selectedIds.includes(id);
  }, [selectedIds]);

  const isAllSelected = useCallback((ids: string[]) => {
    if (ids.length === 0) return false;
    return ids.every(id => selectedIds.includes(id));
  }, [selectedIds]);

  const isPartiallySelected = useCallback((ids: string[]) => {
    if (ids.length === 0) return false;
    const selectedCount = ids.filter(id => selectedIds.includes(id)).length;
    return selectedCount > 0 && selectedCount < ids.length;
  }, [selectedIds]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(selectedId => selectedId !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  const toggleAllSelection = useCallback((ids: string[]) => {
    setSelectedIds(prev => {
      const allSelected = ids.every(id => prev.includes(id));
      
      if (allSelected) {
        // Remove all provided ids from selection
        return prev.filter(id => !ids.includes(id));
      } else {
        // Add all provided ids to selection (avoiding duplicates)
        const newIds = ids.filter(id => !prev.includes(id));
        return [...prev, ...newIds];
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const selectMultiple = useCallback((ids: string[]) => {
    setSelectedIds(prev => {
      // Merge without duplicates
      const combined = [...prev, ...ids];
      return Array.from(new Set(combined));
    });
  }, []);

  const selectedCount = useMemo(() => selectedIds.length, [selectedIds]);

  return {
    selectedIds,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    toggleSelection,
    toggleAllSelection,
    clearSelection,
    selectMultiple,
    selectedCount
  };
}