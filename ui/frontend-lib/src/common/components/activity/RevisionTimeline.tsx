import { Icon } from "@iconify/react";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import { AuditLogEntity } from "../../../types";
import { HorizontalTimeline } from "../HorizontalTimeline";
import { RelativeTime } from "../RelativeTime";

interface RevisionTimelineProps {
  revision: string;
  logs: AuditLogEntity[];
  actionsWithLogs: string[];
  onRevisionClick?: (revisionNumber: number) => void;
  onOpenDialog: (rowId: string, view: "summary" | "logs") => void;
}

export const RevisionTimeline = ({
  revision,
  logs,
  actionsWithLogs,
  onRevisionClick,
  onOpenDialog,
}: RevisionTimelineProps) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Chip
          label={revision}
          size="small"
          color="primary"
          variant="outlined"
          sx={{
            cursor: logs[0].revision_number ? "pointer" : "default",
          }}
          onClick={() => {
            if (logs[0].revision_number && onRevisionClick) {
              onRevisionClick(logs[0].revision_number);
            }
          }}
        />
        <RelativeTime date={logs[0].created_at} sx={{ fontSize: "0.75rem" }} />
      </Stack>
      <Box sx={{ mt: 3 }}>
        <HorizontalTimeline
          items={[...logs].reverse()}
          renderItem={(log) => (
            <>
              <Typography variant="body2" fontWeight={500} sx={{ mt: 0.5 }}>
                {log.action}
              </Typography>
              <RelativeTime
                date={log.created_at}
                user={log.creator}
                sx={{ fontSize: "0.7rem" }}
              />
              {actionsWithLogs.includes(log.action) && (
                <Stack
                  direction="row"
                  spacing={0.25}
                  sx={{
                    mt: 0.25,
                    "& .MuiIconButton-root": {
                      border: "none",
                    },
                  }}
                >
                  {log.action !== "sync" && (
                    <Tooltip title="Summary">
                      <IconButton
                        size="small"
                        onClick={() => onOpenDialog(log.id, "summary")}
                      >
                        <AutoAwesomeIcon sx={{ fontSize: "1rem" }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Logs">
                    <IconButton
                      size="small"
                      onClick={() => onOpenDialog(log.id, "logs")}
                    >
                      <Icon icon="ix:log" width={16} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              )}
            </>
          )}
        />
      </Box>
    </Box>
  );
};
