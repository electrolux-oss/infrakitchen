import { useCallback, useState } from "react";

import { PaginationModel } from "../../ui/DataTable.types";
import { useLocalStorage } from "../context/UIStateContext";

/**
 * Pagination model whose page size ("Rows per page") is remembered in
 * localStorage under `storageKey`. The page index is not persisted.
 */
export function usePersistedPagination(
  storageKey: string,
  defaultPageSize = 10,
  allowedPageSizes?: number[],
) {
  const { get, setKey } = useLocalStorage<Record<string, number>>();

  const [paginationModel, setModel] = useState<PaginationModel>(() => {
    const saved = get(storageKey);
    const valid =
      typeof saved === "number" &&
      (!allowedPageSizes || allowedPageSizes.includes(saved));
    return { page: 0, pageSize: valid ? saved : defaultPageSize };
  });

  const setPaginationModel = useCallback(
    (next: PaginationModel | ((prev: PaginationModel) => PaginationModel)) => {
      setModel((prev) => {
        const model = typeof next === "function" ? next(prev) : next;
        if (model.pageSize !== prev.pageSize) {
          setKey(storageKey, model.pageSize);
        }
        return model;
      });
    },
    [setKey, storageKey],
  );

  return [paginationModel, setPaginationModel] as const;
}
