import { Icon } from "@iconify/react";
import ixLogData from "@iconify-icons/ix/log";

import { AutoAwesomeIcon } from "../../icons/material";
import { IconButton, Tooltip } from "../../ui";

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
    <div className="flex h-full items-center gap-2">
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
          <Icon icon={ixLogData} ssr />
        </IconButton>
      </Tooltip>
    </div>
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
