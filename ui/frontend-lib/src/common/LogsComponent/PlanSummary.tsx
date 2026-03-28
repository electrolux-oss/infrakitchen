import { type SyntheticEvent, useState } from "react";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import Ansi from "ansi-to-react";

import { ENTITY_STATUS } from "../../utils/constants";
import StatusChip from "../StatusChip";
import { ChangeSummary, getActionColor } from "../utils/parsePlanSummary";

interface PlanSummaryProps {
  changes: ChangeSummary[];
  status?: "DONE" | "ERROR" | "IN_PROGRESS";
  description?: string;
}

const getStatusChipValue = (status?: string): string => {
  const normalizedStatus = String(status ?? "")
    .trim()
    .toUpperCase();

  switch (normalizedStatus) {
    case "ERROR":
      return ENTITY_STATUS.ERROR;
    case "IN_PROGRESS":
      return ENTITY_STATUS.IN_PROGRESS;
    case "DONE":
      return ENTITY_STATUS.DONE;
    default:
      return ENTITY_STATUS.UNKNOWN;
  }
};

const getChangeExecutionChip = (
  executionStatus?: ChangeSummary["executionStatus"],
) => {
  if (executionStatus === "ERROR") {
    return { label: "Error", color: "error" as const };
  }

  if (executionStatus === "IN_PROGRESS") {
    return { label: "In progress", color: "info" as const };
  }

  if (executionStatus === "COMPLETE") {
    return { label: "Complete", color: "success" as const };
  }

  return null;
};

export const PlanSummary = ({
  changes,
  status,
  description,
}: PlanSummaryProps) => {
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange =
    (id: string) => (_: SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? id : false);
    };
  return (
    <Stack>
      <Box sx={{ px: 0.5, mb: 2 }}>
        {description && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            {description}
          </Typography>
        )}
        <Typography variant="body2">
          <Box component="span" sx={{ fontWeight: 600 }}>
            Status:
          </Box>{" "}
          <Box
            component="span"
            sx={{ display: "inline-flex", verticalAlign: "middle" }}
          >
            {status !== undefined && (
              <StatusChip status={getStatusChipValue(status)} />
            )}
          </Box>
        </Typography>
      </Box>
      {changes.length === 0 && (
        <Box sx={{ p: 2 }}>
          <Typography color="text.secondary">No changes in summary.</Typography>
        </Box>
      )}
      {changes.map((change) => (
        <Accordion
          key={change.id}
          expanded={expanded === change.id}
          onChange={handleChange(change.id)}
          variant="outlined"
          disableGutters
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                gap: 2,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Chip
                  label={change.action}
                  size="small"
                  color={getActionColor(change.action)}
                  variant="outlined"
                  sx={{ minWidth: 100, fontWeight: 600 }}
                />
                <Typography
                  sx={{
                    fontFamily: "monospace",
                    fontSize: "0.95rem",
                    fontWeight: 500,
                  }}
                >
                  {change.resourceType}.{change.resourceName}
                </Typography>
              </Box>
              {(() => {
                const executionChip = getChangeExecutionChip(
                  change.executionStatus,
                );
                if (!executionChip) return null;
                return (
                  <Chip
                    label={executionChip.label}
                    size="small"
                    color={executionChip.color}
                    variant="outlined"
                    sx={{ minWidth: 110, fontWeight: 600 }}
                  />
                );
              })()}
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <Box
              component="div"
              sx={{
                m: 0,
                p: 1.5,
                fontFamily: "monospace",
                fontSize: "0.8rem",
                bgcolor: "background.default",
                borderTop: "1px solid",
                borderColor: "divider",
                overflowX: "auto",
              }}
            >
              <List dense>
                {change.rawLines.map((line, index) => (
                  <ListItem disablePadding key={`${change.id}-${index}`}>
                    <ListItemText sx={{ margin: 0 }}>
                      <pre style={{ margin: 0 }}>
                        <Ansi>{line || " "}</Ansi>
                      </pre>
                    </ListItemText>
                  </ListItem>
                ))}
              </List>
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Stack>
  );
};
