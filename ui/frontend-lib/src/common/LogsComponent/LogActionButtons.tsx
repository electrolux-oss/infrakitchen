import { Icon } from "@iconify/react";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { Box, IconButton, Tooltip } from "@mui/material";

const isTerraformLanguage = (lang?: string): boolean =>
  lang === "opentofu" || lang === "terraform";

export const ACTIONS_WITH_LOGS = [
  "sync",
  "dryrun",
  "dryrun_with_temp_state",
  "execute",
  "any",
];

export interface LogActionButtonsProps {
  action: string;
  sourceCodeLanguage?: string;
  onOpenSummary?: () => void;
  onOpenLogs: () => void;
}

export const LogActionButtons = ({
  action,
  sourceCodeLanguage,
  onOpenSummary,
  onOpenLogs,
}: LogActionButtonsProps) => {
  if (!ACTIONS_WITH_LOGS.includes(action)) return null;

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        alignItems: "center",
        height: "100%",
      }}
    >
      {action !== "sync" &&
        isTerraformLanguage(sourceCodeLanguage) &&
        onOpenSummary && (
          <Tooltip title="Summary">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSummary();
              }}
            >
              <AutoAwesomeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      <Tooltip title="Logs">
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onOpenLogs();
          }}
        >
          <Icon icon="ix:log" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export const getDialogTitle = (
  view: "summary" | "logs",
  action?: string | null,
): string => {
  if (view === "logs") return "Logs";

  switch (action) {
    case "dryrun":
    case "dryrun_with_temp_state":
      return "Plan Summary";
    case "execute":
      return "Apply Summary";
    default:
      return "Execution Summary";
  }
};
