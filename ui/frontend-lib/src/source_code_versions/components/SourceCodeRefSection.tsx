import { useState, useMemo } from "react";

import { useLocation } from "react-router";

import {
  buildAdvancedApiFilters,
  useEntityListProvider,
  EntityListProvider,
  FilterClause,
  FilterState,
  FilterRenderer,
  useEntityProvider,
  useLocalStorage,
} from "../../common";
import { BaseCard } from "../../common/components/cards/BaseCard";
import { useHashParams } from "../../common/hooks/useHashParams";
import {
  Alert,
  Spinner,
  FormControlLabel,
  Switch,
  TablePagination,
} from "../../ui";
import { PaginationModel } from "../../ui";
import { ENTITY_STATUS } from "../../utils";
import { SCV_FIELD_MAP } from "../graphql";
import { RefType } from "../types";

import { SourceCodeRefRow } from "./SourceCodeRefRow";

const matchesRefFilterClause = (ref: string, clause: FilterClause) => {
  const normalizedRef = ref.toLowerCase();
  const rawValue = clause.value;

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return true;
  }

  const value = String(rawValue).toLowerCase();

  switch (clause.operator) {
    case "eq":
      return normalizedRef === value;
    case "not_like":
      return !normalizedRef.includes(value);
    case "like":
    default:
      return normalizedRef.includes(value);
  }
};

type SourceCodeRefSectionProps = {
  refs: string[];
  type: RefType;
  sourceCodeId: string;
  getFolders: (ref: string) => string[];
};

/**
 * Empty state for the Tags/Branches tab. "Not synced" (no default branch on
 * the source code entity) hints at the sync action; a synced repo with none
 * of this ref kind just reports the plain fact.
 */
const RefEmptyState = ({ type }: { type: RefType }) => {
  const { entity } = useEntityProvider();
  const synced = Boolean(
    (entity as { defaultBranch?: string | null })?.defaultBranch,
  );
  const label = type === RefType.TAG ? "tags" : "branches";

  return (
    <Alert className="mt-2" severity="info">
      {synced
        ? `This repository has no ${label}.`
        : `This repository has not been synced yet. Trigger a sync to load ${label}.`}
    </Alert>
  );
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
  const [hashParams] = useHashParams();
  const versionIdFromUrl = hashParams.get("versionId") ?? null;

  const { entities, total, loading, refreshList } = useEntityListProvider();

  const versionMap = useMemo(() => {
    return new Map(
      entities.map((v) => [
        type === RefType.BRANCH ? v.sourceCodeBranch : v.sourceCodeVersion,
        v,
      ]),
    );
  }, [entities, type]);

  const resolveEntityForRef = (ref: string) => {
    if (type !== RefType.BRANCH) {
      return versionMap.get(ref);
    }

    const normalizedRef = ref.replace(/^origin\//, "");

    return (
      versionMap.get(ref) ??
      versionMap.get(normalizedRef) ??
      versionMap.get(`origin/${normalizedRef}`)
    );
  };

  const displayRefs = useMemo(() => {
    if (enabledOnly) {
      return entities
        .map((v) =>
          type === RefType.BRANCH ? v.sourceCodeBranch : v.sourceCodeVersion,
        )
        .filter((r): r is string => !!r);
    }
    return pagedRefs;
  }, [enabledOnly, entities, pagedRefs, type]);

  return (
    <div className="flex flex-col gap-1.5">
      {loading ? (
        <div className="flex justify-center p-8">
          <Spinner size={32} />
        </div>
      ) : (
        displayRefs.map((ref: string) => {
          const entity = resolveEntityForRef(ref);
          const logSharing = entity?.id === versionIdFromUrl;

          return (
            <SourceCodeRefRow
              key={ref}
              entry={ref}
              type={type}
              sourceCodeId={sourceCodeId}
              gitFolders={getFolders(ref)}
              entity={entity}
              onRefresh={refreshList}
              defaultOpen={ref === defaultOpenRef || logSharing}
              defaultTab={logSharing ? "audit" : "metadata"}
            />
          );
        })
      )}

      <TablePagination
        className="mt-2 border-t border-divider"
        count={enabledOnly ? total : refs.length}
        page={page - 1}
        onPageChange={(_, newPage) => onPageChange(newPage + 1)}
        rowsPerPage={perPage}
        onRowsPerPageChange={(e) =>
          onRowsPerPageChange(parseInt(e.target.value, 10))
        }
        rowsPerPageOptions={[5, 10, 25]}
      />
    </div>
  );
};

export const SourceCodeRefSection = ({
  refs,
  type,
  sourceCodeId,
  getFolders,
}: SourceCodeRefSectionProps) => {
  const { get, setKey } = useLocalStorage<Record<string, PaginationModel>>();
  const storageKey = `sourceCodeVersion_entities_${type === RefType.BRANCH ? "branches" : "tags"}`;

  const savedState = get(storageKey);
  const [paginationModel, setPaginationModel] = useState<PaginationModel>(
    savedState || { page: 0, pageSize: 10 },
  );

  const location = useLocation();
  const initialSearch =
    type === RefType.BRANCH
      ? (location.state?.refBranchSearch ?? "")
      : (location.state?.refTagSearch ?? "");
  const refFilterField =
    type === RefType.BRANCH ? "source_code_branch" : "source_code_version";

  const [filterValues, setFilterValues] = useState<FilterState>({
    filter: initialSearch
      ? [
          {
            id: "initial_ref_search",
            field: refFilterField,
            operator: "like",
            value: initialSearch,
          },
        ]
      : [],
    enabled_only: false,
  });

  const filteredRefs = useMemo(() => {
    const clauses = Array.isArray(filterValues.filter)
      ? (filterValues.filter as FilterClause[]).filter(
          (clause) => clause.field === refFilterField,
        )
      : [];

    if (clauses.length === 0) return refs;

    return refs.filter((ref) =>
      clauses.every((clause) => matchesRefFilterClause(ref, clause)),
    );
  }, [refs, filterValues.filter, refFilterField]);

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
    const otherField =
      type === RefType.BRANCH ? "source_code_version" : "source_code_branch";
    const advancedFilters = buildAdvancedApiFilters(filterValues);

    if (filterValues["enabled_only"]) {
      baseFilter.status = ENTITY_STATUS.DONE;
      baseFilter[otherField] = null; // Filter out records that belong to the other type

      return {
        sort: { field: "created_at", order: "DESC" as const },
        filter: { ...baseFilter, ...advancedFilters },
        pagination: {
          page: paginationModel.page + 1,
          perPage: paginationModel.pageSize,
        },
        fields: [
          "source_code_branch",
          "source_code_version",
          "source_code_folder",
          "template.id",
          "template.name",
          "source_code.id",
          "source_code.identifier",
          "id",
          "status",
          "resources_count",
          "variables",
          "outputs",
        ],
      };
    } else {
      baseFilter[refFilterField] = queryRefs;
      return {
        sort: { field: "created_at", order: "DESC" as const },
        filter: baseFilter,
        pagination: { page: 1, perPage: paginationModel.pageSize },
        fields: [
          "source_code_branch",
          "source_code_version",
          "source_code_folder",
          "template.id",
          "template.name",
          "source_code.id",
          "source_code.identifier",
          "id",
          "status",
          "resources_count",
          "variables",
          "outputs",
        ],
      };
    }
  }, [
    sourceCodeId,
    type,
    queryRefs,
    paginationModel,
    filterValues,
    refFilterField,
  ]);

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

  if (refs.length === 0) {
    return <RefEmptyState type={type} />;
  }

  return (
    <EntityListProvider
      entity_name="sourceCodeVersion"
      params={params}
      entityFieldMap={SCV_FIELD_MAP}
    >
      <BaseCard>
        <div className="col-span-full flex max-w-full flex-col p-2">
          <div className="mb-3 flex flex-wrap items-start gap-2">
            <div className="w-[40rem] max-w-full">
              <FilterRenderer
                config={{
                  id: "filter",
                  label: "Filters",
                  fields: [
                    {
                      field: refFilterField,
                      label: type === RefType.BRANCH ? "Branch" : "Tag",
                      operators: ["like", "not_like", "eq"],
                      valueType: "text",
                      defaultOperator: "like",
                    },
                  ],
                }}
                filterValues={filterValues}
                onChange={handleFilterChange}
              />
            </div>
            <FormControlLabel
              className="ml-0 sm:ml-auto"
              control={
                <Switch
                  checked={!!filterValues["enabled_only"]}
                  onChange={(e) =>
                    handleFilterChange("enabled_only", e.target.checked)
                  }
                />
              }
              label="Enabled only"
              labelClassName="text-caption text-fg-muted"
            />
          </div>

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
        </div>
      </BaseCard>
    </EntityListProvider>
  );
};
