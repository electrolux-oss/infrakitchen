import { forwardRef, useEffect, useState, useMemo, useRef } from "react";

import {
  GridPaginationModel,
  GridSortModel,
  GridColumnVisibilityModel,
} from "@mui/x-data-grid";

import { useLocalStorage } from "../..";
import { IkEntity } from "../../../types";
import { buildAdvancedApiFilters } from "../filter_panel/buildAdvancedApiFilters";
import { FilterProvider } from "../filter_panel/FilterContext";

import {
  EntityFetchTableProps,
  EntityFetchTableRef,
} from "./EntityFetchTable.types";
import { EntityFetchTableContent } from "./EntityFetchTableContent";

export type {
  EntityFetchTableProps,
  EntityFetchTableRef,
} from "./EntityFetchTable.types";

interface DataGridState {
  sortModel: GridSortModel;
  paginationModel: GridPaginationModel;
  columnVisibilityModel?: GridColumnVisibilityModel;
}

export const EntityFetchTable = forwardRef<
  EntityFetchTableRef,
  EntityFetchTableProps
>((props, ref) => {
  const {
    title,
    subtitle,
    columns,
    entityName,
    defaultColumnVisibilityModel,
    onFilterChange,
    defaultFilter,
    initialFilters,
    buildApiFilters,
    filterStorageKey,
    entityFieldMap,
    transformFn,
    syncFiltersToUrl,
  } = props;

  const { get, setKey } = useLocalStorage<Record<string, unknown>>();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IkEntity[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  const resolvedFilterStorageKey =
    filterStorageKey ?? `filter_${title.toLowerCase().replace(/\s+/g, "_")}`;

  const buildApiFiltersRef = useRef(buildApiFilters);
  buildApiFiltersRef.current = buildApiFilters ?? buildAdvancedApiFilters;
  const defaultFilterRef = useRef(defaultFilter);
  defaultFilterRef.current = defaultFilter;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const storageKey = `entityTable_${title.toLowerCase().replace(/\s+/g, "_")}`;
  const savedState = get(storageKey) as DataGridState | undefined;

  const [sortModel, setSortModel] = useState<GridSortModel>(
    savedState?.sortModel || [],
  );

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>(
    savedState?.paginationModel || { page: 0, pageSize: 10 },
  );

  const [columnVisibilityModel, setColumnVisibilityModel] =
    useState<GridColumnVisibilityModel>(() => ({
      ...(defaultColumnVisibilityModel ?? {}),
      ...(savedState?.columnVisibilityModel ?? {}),
    }));

  const handleSortModelChange = (newSortModel: GridSortModel) => {
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
    setSortModel(newSortModel);
  };

  const handlePaginationModelChange = (
    newPaginationModel: GridPaginationModel,
  ) => {
    setPaginationModel(newPaginationModel);
  };

  const handleColumnVisibilityModelChange = (
    newColumnVisibilityModel: GridColumnVisibilityModel,
  ) => {
    setColumnVisibilityModel(newColumnVisibilityModel);
  };

  const requestedFields = useMemo(() => {
    const cols = columnsRef.current;
    const requested = new Set<string>(["id"]);

    cols.forEach((column) => {
      const isHidden = columnVisibilityModel[column.field] === false;
      const isNonFilterable = column.filterable === false;

      // If the column has explicit fetchFields, always include them — they are
      // required by the transform regardless of whether the column is visible.
      if (column.fetchFields !== undefined) {
        column.fetchFields.forEach((field) => {
          if (field) requested.add(field);
        });
        // Still skip adding column.field itself when column is hidden/non-filterable
        if (isHidden || isNonFilterable) return;
      } else {
        if (isHidden || isNonFilterable) return;
        requested.add(column.field);
      }
    });

    return Array.from(requested);
  }, [columnVisibilityModel]);

  useEffect(() => {
    setKey(storageKey, {
      sortModel,
      paginationModel,
      columnVisibilityModel,
    });
  }, [sortModel, paginationModel, columnVisibilityModel, storageKey, setKey]);

  return (
    <FilterProvider
      columns={columns}
      storageKey={resolvedFilterStorageKey}
      onFilterChange={onFilterChange}
      syncToUrl={syncFiltersToUrl}
    >
      <EntityFetchTableContent
        ref={ref}
        title={title}
        subtitle={subtitle}
        columns={columns}
        entityName={entityName}
        defaultFilter={defaultFilter}
        initialFilters={initialFilters}
        entityFieldMap={entityFieldMap}
        transformFn={transformFn}
        buildApiFiltersRef={buildApiFiltersRef}
        defaultFilterRef={defaultFilterRef}
        columnsRef={columnsRef}
        loading={loading}
        setLoading={setLoading}
        data={data}
        setData={setData}
        totalRows={totalRows}
        setTotalRows={setTotalRows}
        paginationModel={paginationModel}
        sortModel={sortModel}
        columnVisibilityModel={columnVisibilityModel}
        requestedFields={requestedFields}
        handleSortModelChange={handleSortModelChange}
        handlePaginationModelChange={handlePaginationModelChange}
        handleColumnVisibilityModelChange={handleColumnVisibilityModelChange}
      />
    </FilterProvider>
  );
});

EntityFetchTable.displayName = "EntityFetchTable";
