import { useState, useMemo } from "react";

import { useLocation } from "react-router";

import {
  CircularProgress,
  Box,
  TablePagination,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { GridPaginationModel } from "@mui/x-data-grid";

import {
  useEntityListProvider,
  EntityListProvider,
  FilterState,
  FilterRenderer,
  useLocalStorage,
} from "../../common";
import { OverviewCard } from "../../common/components/OverviewCard";
import { ENTITY_STATUS } from "../../utils";
import { RefType } from "../types";

import { SourceCodeRefRow } from "./SourceCodeRefRow";

type SourceCodeRefSectionProps = {
  refs: string[];
  type: RefType;
  sourceCodeId: string;
  getFolders: (ref: string) => string[];
};

const SourceCodeGitRefRows = ({
  refs,
  pagedRefs,
  type,
  sourceCodeId,
  getFolders,
  page,
  perPage,
  onPageChange,
  onRowsPerPageChange,
  enabledOnly,
  defaultOpenRef,
}: Omit<SourceCodeRefSectionProps, "title" | "icon"> & {
  pagedRefs: string[];
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (perPage: number) => void;
  enabledOnly?: boolean;
  defaultOpenRef?: string;
}) => {
  const { entities, total, loading, refreshList } = useEntityListProvider();

  const versionMap = useMemo(() => {
    return new Map(
      entities.map((v) => [
        type === RefType.BRANCH ? v.source_code_branch : v.source_code_version,
        v,
      ]),
    );
  }, [entities, type]);

  const displayRefs = useMemo(() => {
    if (enabledOnly) {
      return entities
        .map((v) =>
          type === RefType.BRANCH
            ? v.source_code_branch
            : v.source_code_version,
        )
        .filter((r): r is string => !!r);
    }
    return pagedRefs;
  }, [enabledOnly, entities, pagedRefs, type]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        displayRefs.map((ref: string) => (
          <SourceCodeRefRow
            key={ref}
            entry={ref}
            type={type}
            sourceCodeId={sourceCodeId}
            gitFolders={getFolders(ref)}
            entity={
              versionMap.get(ref) ??
              versionMap.get(ref.replace(/^origin\//, ""))
            } // Support imported SCVs that don't have origin/ at the start of the ref
            onRefresh={refreshList}
            defaultOpen={ref === defaultOpenRef}
          />
        ))
      )}

      <TablePagination
        component="div"
        count={enabledOnly ? total : refs.length}
        page={page - 1}
        onPageChange={(_, newPage) => onPageChange(newPage + 1)}
        rowsPerPage={perPage}
        onRowsPerPageChange={(e) =>
          onRowsPerPageChange(parseInt(e.target.value, 10))
        }
        rowsPerPageOptions={[5, 10, 25]}
        sx={{ borderTop: 1, borderColor: "divider", mt: 1 }}
      />
    </Box>
  );
};

export const SourceCodeRefSection = ({
  refs,
  type,
  sourceCodeId,
  getFolders,
}: SourceCodeRefSectionProps) => {
  const { get, setKey } =
    useLocalStorage<Record<string, GridPaginationModel>>();
  const storageKey = `sourceCodeVersion_entities_${type === RefType.BRANCH ? "branches" : "tags"}`;

  const savedState = get(storageKey);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>(
    savedState || { page: 0, pageSize: 10 },
  );

  const location = useLocation();
  const initialSearch =
    type === RefType.BRANCH
      ? (location.state?.refBranchSearch ?? "")
      : (location.state?.refTagSearch ?? "");

  const [filterValues, setFilterValues] = useState<FilterState>({
    ref_search: initialSearch,
    enabled_only: false,
  });

  const filteredRefs = useMemo(() => {
    const search = filterValues["ref_search"]?.toLowerCase();
    if (!search) return refs;
    return refs.filter((ref) => ref.toLowerCase().includes(search));
  }, [refs, filterValues]);

  const pagedRefs = useMemo(() => {
    const start = paginationModel.page * paginationModel.pageSize;
    return filteredRefs.slice(start, start + paginationModel.pageSize);
  }, [filteredRefs, paginationModel]);

  const queryRefs = useMemo(() => {
    if (type !== RefType.BRANCH) return pagedRefs;
    const expanded = new Set(pagedRefs);
    pagedRefs.forEach((ref) => {
      if (ref.startsWith("origin/")) {
        expanded.add(ref.replace(/^origin\//, ""));
      } else {
        expanded.add(`origin/${ref}`);
      }
    });
    return Array.from(expanded);
  }, [pagedRefs, type]);

  const params = useMemo(() => {
    const baseFilter: any = { source_code_id: sourceCodeId };
    const refField =
      type === RefType.BRANCH ? "source_code_branch" : "source_code_version";
    const otherField =
      type === RefType.BRANCH ? "source_code_version" : "source_code_branch";

    if (filterValues["enabled_only"]) {
      baseFilter.status = ENTITY_STATUS.DONE;
      baseFilter[otherField] = null; // Filter out records that belong to the other type

      const search = filterValues["ref_search"];
      if (search) {
        baseFilter[`${refField}__like`] = search;
      }

      return {
        sort: { field: "created_at", order: "DESC" as const },
        filter: baseFilter,
        pagination: {
          page: paginationModel.page + 1,
          perPage: paginationModel.pageSize,
        },
      };
    } else {
      baseFilter[refField] = queryRefs;
      return {
        sort: { field: "created_at", order: "DESC" as const },
        filter: baseFilter,
        pagination: { page: 1, perPage: paginationModel.pageSize },
      };
    }
  }, [sourceCodeId, type, queryRefs, paginationModel, filterValues]);

  const handlePageChange = (newPage: number) => {
    const updatedModel = { ...paginationModel, page: newPage - 1 };
    setPaginationModel(updatedModel);
    setKey(storageKey, updatedModel);
  };

  const handleRowsPerPageChange = (newSize: number) => {
    const updatedModel = { page: 0, pageSize: newSize };
    setPaginationModel(updatedModel);
    setKey(storageKey, updatedModel);
  };

  const handleFilterChange = (id: string, val: any) => {
    setFilterValues((prev) => ({ ...prev, [id]: val }));
    const updatedModel = { ...paginationModel, page: 0 };
    setPaginationModel(updatedModel);
    setKey(storageKey, updatedModel);
  };

  if (refs.length === 0) return null;

  return (
    <EntityListProvider entity_name="source_code_version" params={params}>
      <OverviewCard>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            maxWidth: "100%",
            p: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <Box sx={{ flex: 1 }} />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={!!filterValues["enabled_only"]}
                  onChange={(e) =>
                    handleFilterChange("enabled_only", e.target.checked)
                  }
                />
              }
              label="Enabled only"
              sx={{
                "& .MuiFormControlLabel-label": {
                  fontSize: "0.75rem",
                  color: "text.secondary",
                },
                ml: 1,
              }}
            />
            <Box sx={{ width: "15rem", px: "1rem" }}>
              <FilterRenderer
                config={{
                  id: "ref_search",
                  type: "search",
                  label:
                    type === RefType.BRANCH
                      ? "Filter branches…"
                      : "Filter tags…",
                }}
                filterValues={filterValues}
                onChange={handleFilterChange}
              />
            </Box>
          </Box>

          <SourceCodeGitRefRows
            refs={filteredRefs}
            pagedRefs={pagedRefs}
            type={type}
            sourceCodeId={sourceCodeId}
            getFolders={getFolders}
            page={paginationModel.page + 1}
            perPage={paginationModel.pageSize}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
            enabledOnly={!!filterValues["enabled_only"]}
            defaultOpenRef={initialSearch || undefined}
          />
        </Box>
      </OverviewCard>
    </EntityListProvider>
  );
};
