import { useState } from "react";

import { useNavigate } from "react-router";

import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { useConfig } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { IkEntity } from "../../types";
import { BlueprintExecutionResponse } from "../types";

interface ExecutionTimelineProps {
  executions: BlueprintExecutionResponse[];
}

export const WorkflowTimeline = ({ executions }: ExecutionTimelineProps) => {
  const [loading, setLoading] = useState(false);
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();

  if (executions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No executions yet.
      </Typography>
    );
  }

  const handleClick = (execution_id: string) => {
    setLoading(true);
    ikApi
      .patchRaw(`workflows/${execution_id}/actions`, {
        action: "execute",
      })
      .then((_response: IkEntity) => {
        notify(`Execute task sent successfully`, "success");
      })
      .catch((error) => {
        notifyError(error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Box sx={{ width: "100%" }}>
      {executions.map((exec) => (
        <Box
          key={exec.id}
          sx={{
            mb: 3,
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2,
              py: 1.5,
              borderBottom: 1,
              borderColor: "divider",
              bgcolor: "background.default",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="subtitle2" sx={{ fontFamily: "monospace" }}>
                <Link
                  component="button"
                  variant="subtitle2"
                  sx={{ fontFamily: "monospace", cursor: "pointer" }}
                  onClick={() => navigate(`${linkPrefix}workflows/${exec.id}`)}
                >
                  {exec.id.slice(0, 8)}…
                </Link>
              </Typography>
              <StatusChip status={exec.status} />
              <Button
                color="error"
                onClick={() => handleClick(exec.id)}
                variant="contained"
                disabled={loading}
                aria-label="Action Button"
              >
                Run
                {loading && " ..."}
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {new Date(exec.created_at).toLocaleString()}
            </Typography>
          </Box>

          {exec.status === "in_progress" && <LinearProgress />}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={50}>#</TableCell>
                  <TableCell>Template</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Resource</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {exec.steps.map((step) => (
                  <TableRow key={step.id}>
                    <TableCell>{step.position + 1}</TableCell>
                    <TableCell>
                      <GetEntityLink
                        _entity_name="template"
                        id={step.template_id}
                        identifier="Template"
                      />
                    </TableCell>
                    <TableCell>
                      <StatusChip status={step.status} />
                    </TableCell>
                    <TableCell>
                      {step.resource_id ? (
                        <Chip
                          label={step.resource_id.slice(0, 8) + "…"}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {step.error_message ? (
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{ maxWidth: 200, display: "block" }}
                          noWrap
                        >
                          {step.error_message}
                        </Typography>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}
    </Box>
  );
};
