import { Box, Typography } from "@mui/material";

import { humanizeEntityType } from "../../common/components/entities/Entity";
import { Label } from "../../common/components/labels/Label";
import { CODE_FONT_FAMILY } from "../../common/theme";

/**
 * Cell for audit rows whose backing entity is gone.
 */
export const DeletedEntityCell = ({
  entityId,
  entityType,
}: {
  entityId: string;
  entityType: string;
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
      [Deleted]
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
