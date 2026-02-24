import { useState, ElementType, useMemo } from "react";

import {
  CircularProgress,
  Box,
  TablePagination,
  Typography,
  Chip,
  Divider,
} from "@mui/material";

import { useEntityListProvider, EntityListProvider } from "../../common";
import { RefType, SourceCodeVersionResponse } from "../types";

import { SourceCodeRefRow } from "./SourceCodeRefRow";

function buildVersionedByRef(
  entities: SourceCodeVersionResponse[],
  type: RefType,
): Map<string, SourceCodeVersionResponse> {
  return new Map(
    entities.map((v) => [
      type === RefType.BRANCH ? v.source_code_branch : v.source_code_version,
      v,
    ]),
  );
}

type SourceCodeRefSectionProps = {
  title: string;
  icon: ElementType;
  refs: string[];
  type: RefType;
  sourceCodeId: string;
  getFolders: (ref: string) => string[];
};

const SourceCodeGitRefRows = ({
  refs,
  type,
  sourceCodeId,
  getFolders,
  page,
  perPage,
  onPageChange,
  onRowsPerPageChange,
}: Omit<SourceCodeRefSectionProps, "title" | "icon"> & {
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (perPage: number) => void;
}) => {
  const { entities, loading, refreshList } = useEntityListProvider();

  if (loading) {
    return (
      <CircularProgress
        size={24}
        sx={{ my: 1, mx: "auto", display: "block" }}
      />
    );
  }

  const versionedByRef = buildVersionedByRef(entities, type);
  const pagedRefs = refs.slice((page - 1) * perPage, page * perPage);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      {pagedRefs.map((ref) => (
        <SourceCodeRefRow
          key={ref}
          entry={ref}
          type={type}
          sourceCodeId={sourceCodeId}
          gitFolders={getFolders(ref)}
          entity={versionedByRef.get(ref)}
          onVersionCreate={refreshList}
        />
      ))}
      <TablePagination
        component="div"
        count={refs.length}
        page={page - 1}
        onPageChange={(_, newPage) => onPageChange(newPage + 1)}
        rowsPerPage={perPage}
        onRowsPerPageChange={(e) => {
          onRowsPerPageChange(parseInt(e.target.value, 10));
        }}
        rowsPerPageOptions={[5, 10, 25]}
        sx={{ borderTop: 1, borderColor: "divider", mt: 1 }}
      />
    </Box>
  );
};

export const SourceCodeRefSection = ({
  title,
  icon: Icon,
  refs,
  type,
  sourceCodeId,
  getFolders,
}: SourceCodeRefSectionProps) => {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const params = useMemo(
    () => ({
      sort: { field: "created_at", order: "DESC" as const },
      filter: {
        source_code_id: sourceCodeId,
        ...(type === RefType.TAG
          ? { source_code_branch: null }
          : { source_code_version: null }),
      },
    }),
    [sourceCodeId, type],
  );

  if (refs.length === 0) return null;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Icon sx={{ fontSize: "0.95rem", color: "text.disabled" }} />
        <Typography
          variant="overline"
          sx={{
            color: "text.secondary",
            lineHeight: 1,
            whiteSpace: "nowrap",
            fontSize: "0.7rem",
          }}
        >
          {title}
        </Typography>
        <Chip
          label={refs.length}
          size="small"
          variant="outlined"
          sx={{
            height: 16,
            fontSize: "0.65rem",
            "& .MuiChip-label": { px: 0.75 },
          }}
        />
        <Divider sx={{ flex: 1 }} />
      </Box>
      <EntityListProvider entity_name="source_code_version" params={params}>
        <SourceCodeGitRefRows
          refs={refs}
          type={type}
          sourceCodeId={sourceCodeId}
          getFolders={getFolders}
          page={page}
          perPage={perPage}
          onPageChange={setPage}
          onRowsPerPageChange={(newPerPage) => {
            setPerPage(newPerPage);
            setPage(1);
          }}
        />
      </EntityListProvider>
    </Box>
  );
};
