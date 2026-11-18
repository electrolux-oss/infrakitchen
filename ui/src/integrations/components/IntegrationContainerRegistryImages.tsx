import { useEffect, useMemo, useState } from "react";

import { PropertyCard } from "../../common/components/cards/PropertyCard";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { isClauseComplete } from "../../common/components/filter_panel/clauseUtils";
import { FilterBar } from "../../common/components/filter_panel/FilterBar";
import {
  FilterClause,
  FilterConfig,
} from "../../common/components/filter_panel/FilterConfig";
import { useConfig } from "../../common/context/ConfigContext";
import { usePersistedPagination } from "../../common/hooks/usePersistedPagination";
import { CODE_FONT_FAMILY } from "../../common/theme";
import { TagChip } from "../../source_codes/components/SourceCodeCommits";
import { Alert, DataTable, DataTableColumn, RenderCellParams } from "../../ui";
import { CONTAINER_REGISTRY_IMAGES_QUERY } from "../graphql/queries";

const REPOSITORY_FIELD = "repository";

/** The API only supports a case-insensitive substring match on the name. */
const IMAGES_FILTER_CONFIG: FilterConfig = {
  id: "container_registry_images",
  label: "Images",
  fields: [
    {
      field: REPOSITORY_FIELD,
      label: "Repository",
      operators: ["like"],
      defaultOperator: "like",
      valueType: "text",
      defaultSelected: true,
      placeholder: "e.g. backend",
    },
  ],
  defaultField: REPOSITORY_FIELD,
};

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

interface RegistryImage {
  registry_host: string;
  repository: string;
  tags: string[];
  digest: string;
  pushed_at: string | null;
  size_bytes: number | null;
}

/** One row per tag. An untagged image gets a single row with `tag: null`. */
interface RegistryImageRow {
  id: string;
  repository: string;
  tag: string | null;
  digest: string;
  pushed_at: string | null;
  size_bytes: number | null;
}

const toRows = (images: RegistryImage[]): RegistryImageRow[] =>
  images.flatMap((image) => {
    const tags: (string | null)[] = image.tags.length > 0 ? image.tags : [null];
    return tags.map((tag) => ({
      id: `${image.repository}@${image.digest}:${tag ?? ""}`,
      repository: image.repository,
      tag,
      digest: image.digest,
      pushed_at: image.pushed_at,
      size_bytes: image.size_bytes,
    }));
  });

export interface IntegrationContainerRegistryImagesProps {
  integrationId: string;
}

const FILTER_DEBOUNCE_MS = 300;

const formatSize = (bytes: number | null) => {
  if (bytes === null) return "-";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Read-only list of the images stored in a container registry integration,
 * with an optional repository-name filter.
 */
export const IntegrationContainerRegistryImages = ({
  integrationId,
}: IntegrationContainerRegistryImagesProps) => {
  const { ikApi } = useConfig();
  const [filterClauses, setFilterClauses] = useState<FilterClause[]>([]);
  const [repositoryFilter, setRepositoryFilter] = useState("");
  const [images, setImages] = useState<RegistryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = usePersistedPagination(
    "container_registry_images_pageSize",
    ROWS_PER_PAGE_OPTIONS[0],
    ROWS_PER_PAGE_OPTIONS,
  );

  const rows = useMemo(() => toRows(images), [images]);

  const columns: DataTableColumn<RegistryImageRow>[] = useMemo(
    () => [
      {
        field: "repository",
        headerName: "Repository",
        flex: 1,
        renderCell: (params: RenderCellParams<RegistryImageRow>) => (
          <span style={{ fontFamily: CODE_FONT_FAMILY }}>
            {params.row.repository}
          </span>
        ),
      },
      {
        field: "tag",
        headerName: "Tag",
        width: 180,
        renderCell: (params: RenderCellParams<RegistryImageRow>) =>
          params.row.tag ? (
            <TagChip tag={params.row.tag} />
          ) : (
            <span className="text-fg-muted">Untagged</span>
          ),
      },
      {
        field: "digest",
        headerName: "Digest",
        width: 180,
        renderCell: (params: RenderCellParams<RegistryImageRow>) => (
          <span style={{ fontFamily: CODE_FONT_FAMILY }}>
            {params.row.digest.slice(0, 19)}
          </span>
        ),
      },
      {
        field: "pushed_at",
        headerName: "Pushed",
        width: 150,
        align: "right",
        headerAlign: "right",
        renderCell: (params: RenderCellParams<RegistryImageRow>) =>
          params.row.pushed_at ? (
            <RelativeTime date={params.row.pushed_at} compact />
          ) : (
            "-"
          ),
      },
      {
        field: "size_bytes",
        headerName: "Size",
        width: 100,
        align: "right",
        headerAlign: "right",
        renderCell: (params: RenderCellParams<RegistryImageRow>) =>
          formatSize(params.row.size_bytes),
      },
    ],
    [],
  );

  const repositoryInput = useMemo(() => {
    const clause = filterClauses.find(
      (c) => c.field === REPOSITORY_FIELD && isClauseComplete(c),
    );
    return typeof clause?.value === "string" ? clause.value : "";
  }, [filterClauses]);

  useEffect(() => {
    const timer = setTimeout(
      () => setRepositoryFilter(repositoryInput.trim()),
      FILTER_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [repositoryInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    ikApi
      .graphqlRequest<{ containerRegistryImages: RegistryImage[] }>(
        CONTAINER_REGISTRY_IMAGES_QUERY,
        {
          integrationId,
          repositoryFilter: repositoryFilter || null,
        },
      )
      .then((response) => {
        if (!active) return;
        setImages(response.containerRegistryImages);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setImages([]);
        setError(err instanceof Error ? err.message : "Failed to load images");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ikApi, integrationId, repositoryFilter]);

  return (
    <PropertyCard title={null}>
      <FilterBar
        className="mb-4"
        config={IMAGES_FILTER_CONFIG}
        value={filterClauses}
        onChange={setFilterClauses}
      />
      {error && <Alert severity="error">{error}</Alert>}
      {!error && (
        <DataTable
          rows={rows}
          getRowId={(row) => row.id}
          columns={columns}
          loading={loading}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={ROWS_PER_PAGE_OPTIONS}
          emptyLabel={
            repositoryFilter
              ? `No images found for "${repositoryFilter}".`
              : "No images found."
          }
        />
      )}
    </PropertyCard>
  );
};
