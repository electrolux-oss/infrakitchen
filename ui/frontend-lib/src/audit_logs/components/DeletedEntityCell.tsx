import { Box, Typography } from "@mui/material";

import { humanizeEntityType } from "../../common/components/entities/Entity";
import { Label } from "../../common/components/labels/Label";
import { CODE_FONT_FAMILY } from "../../common/theme";
import type { UnresolvedEntityReason } from "../utils/auditLogEntity";

const RESOLUTION_LABELS: Record<UnresolvedEntityReason, string> = {
  deleted: "[Deleted]",
  untracked: "[No detail available]",
};

/**
 * Cell for permission-denial rows: the request was rejected at the gate, so
 * no concrete entity was ever touched and there is no ID to show.
 */
export const DeniedEntityCell = ({
  entityType,
  action,
}: {
  entityType: string;
  action?: string;
}) => (
  <Typography variant="body2" sx={{ color: "error.main" }}>
    {action ? `${action.charAt(0).toUpperCase()}${action.slice(1)} ` : ""}
    {humanizeEntityType(entityType)} request was denied
  </Typography>
);

/**
 * Cell for audit rows whose backing entity cannot be resolved.
 *
 * "deleted" — the row is gone from the database.
 * "untracked" — the model type simply has no server-side detail loader;
 * the entity itself is probably still there.
 */
export const DeletedEntityCell = ({
  entityId,
  entityType,
  reason,
}: {
  entityId: string;
  entityType: string;
  reason: UnresolvedEntityReason;
}) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      gap: 0.5,
      minWidth: 0,
    }}
  >
    <Typography variant="body2" sx={{ color: "text.secondary" }}>
      {RESOLUTION_LABELS[reason]}
    </Typography>
    {entityId && (
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
      >
        <Typography
          variant="caption"
          sx={{
            fontFamily: CODE_FONT_FAMILY,
            color: "text.secondary",
            wordBreak: "break-all",
          }}
        >
          {entityId}
        </Typography>
        <Label label={humanizeEntityType(entityType)} />
      </Box>
    )}
  </Box>
);
