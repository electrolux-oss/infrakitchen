import { useCallback, useEffect, useMemo, useState } from "react";

import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import {
  Alert,
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";

import { PropertyCard } from "../../common/components/cards/PropertyCard";
import { useConfig } from "../../common/context";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notifyError } from "../../common/hooks/useNotification";
import {
  DEFAULT_ENVIRONMENT_NAME,
  environmentRegions,
  GqlIacEnvironment,
  GqlIacModule,
  GqlIacRun,
  GqlSourceCode,
  IAC_LATEST_RUNS_QUERY,
  isActiveRun,
} from "../graphql";

import { useIacEnvironmentConfigs } from "./iac/IacEnvironments";
import { IacStackDialog, PlanChanges } from "./iac/IacStackDialog";

const POLL_INTERVAL_MS = 5000;

const displayPath = (path: string) => path || "/";

const stackKey = (
  modulePath: string,
  environmentName: string,
  region: string | null,
) => [modulePath, environmentName, region ?? ""].join("\u0000");

const RUN_CHIP_COLOR: Record<string, "success" | "error" | "info"> = {
  done: "success",
  error: "error",
  queued: "info",
  in_progress: "info",
};

interface StackChipProps {
  label: string;
  workingDir: string;
  varFiles: string[];
  run: GqlIacRun | undefined;
  configured: boolean;
  onOpen: () => void;
}

// One module in one environment (and region): its latest run, opened to plan it.
const StackChip = ({
  label,
  workingDir,
  varFiles,
  run,
  configured,
  onOpen,
}: StackChipProps) => {
  const status = run?.status.toLowerCase();
  return (
    <Tooltip
      title={
        <Box>
          <div>Runs in {displayPath(workingDir)}</div>
          {varFiles.length > 0 && <div>Var files: {varFiles.join(", ")}</div>}
          {!configured && <div>Environment is not configured yet</div>}
          {run && (
            <div>
              Last {run.action}: {status}
              {run.sha ? ` at ${run.sha.slice(0, 7)}` : ""}
            </div>
          )}
        </Box>
      }
    >
      <Box
        sx={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.5,
        }}
      >
        <Chip
          size="small"
          clickable
          onClick={onOpen}
          variant={run ? "filled" : "outlined"}
          color={status ? (RUN_CHIP_COLOR[status] ?? "default") : "primary"}
          sx={configured ? undefined : { borderStyle: "dashed" }}
          label={label}
        />
        {run &&
          (isActiveRun(run) ? (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {status === "queued" ? "Queued" : "Running"}
            </Typography>
          ) : (
            <Box sx={{ typography: "caption" }}>
              <PlanChanges run={run} />
            </Box>
          ))}
      </Box>
    </Tooltip>
  );
};

interface OpenStack {
  module: GqlIacModule;
  environment: string;
  region: string | null;
}

interface SourceCodeModulesProps {
  sourceCode: GqlSourceCode;
}

export const SourceCodeModules = ({ sourceCode }: SourceCodeModulesProps) => {
  const { ikApi } = useConfig();
  const { checkActionPermission } = usePermissionProvider();
  const canPlan = checkActionPermission("api:source_code", "write");
  const modules = useMemo(
    () => sourceCode.iacModules ?? [],
    [sourceCode.iacModules],
  );
  const environmentNames = sourceCode.iacEnvironmentNames ?? [];
  const environmentCount = environmentNames.length;
  const branch = sourceCode.defaultBranch ?? "the default branch";

  const { configs } = useIacEnvironmentConfigs(sourceCode.id);
  const configsByName = useMemo(
    () => new Map(configs.map((config) => [config.name, config])),
    [configs],
  );
  const [latestRuns, setLatestRuns] = useState<GqlIacRun[]>([]);
  const [open, setOpen] = useState<OpenStack | null>(null);

  const loadLatestRuns = useCallback(async () => {
    try {
      const response = await ikApi.graphqlRequest<{
        iacLatestRuns: GqlIacRun[];
      }>(IAC_LATEST_RUNS_QUERY, { sourceCodeId: sourceCode.id });
      setLatestRuns(response.iacLatestRuns || []);
    } catch (error) {
      notifyError(error);
    }
  }, [ikApi, sourceCode.id]);

  useEffect(() => {
    void loadLatestRuns();
  }, [loadLatestRuns]);

  const anyActive = latestRuns.some(isActiveRun);
  useEffect(() => {
    if (!anyActive) return;
    const timer = window.setInterval(
      () => void loadLatestRuns(),
      POLL_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [anyActive, loadLatestRuns]);

  const runsByStack = useMemo(
    () =>
      new Map(
        latestRuns.map((run) => [
          stackKey(run.modulePath, run.environmentName, run.region),
          run,
        ]),
      ),
    [latestRuns],
  );

  const renderEnvironment = (
    module: GqlIacModule,
    environment: GqlIacEnvironment,
  ) => {
    const config = configsByName.get(environment.name);
    const regions = environmentRegions(environment, config);
    const chip = (
      label: string,
      region: string | null,
      workingDir: string,
      varFiles: string[],
    ) => (
      <StackChip
        key={region ?? ""}
        label={label}
        workingDir={workingDir}
        varFiles={varFiles}
        run={runsByStack.get(stackKey(module.path, environment.name, region))}
        configured={config !== undefined}
        onOpen={() =>
          setOpen({ module, environment: environment.name, region })
        }
      />
    );

    if (regions.length === 0) {
      return chip(
        environment.name,
        null,
        environment.workingDir,
        environment.varFiles,
      );
    }
    // Deployed to several regions: one chip per region.
    return (
      <Box
        sx={{
          display: "inline-flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 1,
        }}
      >
        {regions.map((region) =>
          chip(region.name, region.name, region.workingDir, region.varFiles),
        )}
      </Box>
    );
  };

  return (
    <PropertyCard
      title="Modules"
      subtitle={`${modules.length} modules and ${environmentCount} environments discovered on ${branch}, as of the last sync. Click an environment or region to plan it.`}
    >
      {modules.length === 0 ? (
        <Alert severity="info">
          No Terraform or OpenTofu modules were found on {branch}.
        </Alert>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Module</TableCell>
                {environmentNames.map((name) => (
                  <TableCell key={name} align="center">
                    {name}
                  </TableCell>
                ))}
                {environmentCount === 0 && <TableCell align="center" />}
              </TableRow>
            </TableHead>
            <TableBody>
              {modules.map((module) => {
                const byName = new Map(
                  module.environments.map((env) => [env.name, env]),
                );
                return (
                  <TableRow key={module.path}>
                    <TableCell>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <FolderOutlinedIcon
                          fontSize="small"
                          sx={{ color: "text.secondary" }}
                        />
                        <Box>
                          <Typography variant="body2">{module.name}</Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              fontFamily: "monospace",
                            }}
                          >
                            {displayPath(module.path)}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    {module.environments.length === 0 ? (
                      // Run as is, under the "default" environment.
                      <TableCell
                        colSpan={Math.max(environmentCount, 1)}
                        align="center"
                      >
                        {renderEnvironment(module, {
                          name: DEFAULT_ENVIRONMENT_NAME,
                          workingDir: module.path,
                          varFiles: [],
                          regions: [],
                        })}
                      </TableCell>
                    ) : (
                      environmentNames.map((name) => {
                        const environment = byName.get(name);
                        return (
                          <TableCell key={name} align="center">
                            {environment ? (
                              renderEnvironment(module, environment)
                            ) : (
                              <Typography
                                variant="body2"
                                sx={{ color: "text.disabled" }}
                              >
                                —
                              </Typography>
                            )}
                          </TableCell>
                        );
                      })
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
      {open && (
        <IacStackDialog
          sourceCodeId={sourceCode.id}
          defaultBranch={sourceCode.defaultBranch}
          tags={sourceCode.gitTags ?? []}
          module={open.module}
          environmentName={open.environment}
          region={open.region}
          configured={configsByName.has(open.environment)}
          canPlan={canPlan}
          onClose={() => setOpen(null)}
          onRunsChanged={loadLatestRuns}
        />
      )}
    </PropertyCard>
  );
};
