import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { StatusLabel } from "../../common/components/labels";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { LogsDialog } from "../../common/LogsComponent/LogsDialog";
import { HeroArrowPathIcon } from "../../icons";
import {
  getCommitTags,
  SourceCodeCommits,
} from "../../source_codes/components/SourceCodeCommits";
import { GqlSourceCodeCommit } from "../../source_codes/graphql";
import { Alert, Button, IconButton, Tooltip } from "../../ui";
import {
  BUILD_SERVICE_MUTATION,
  getImageRepositoryUrl,
  GqlService,
  GqlServiceBuild,
  GqlServiceSourceCode,
  SERVICE_BUILDS_QUERY,
  SERVICE_SOURCE_CODE_STATUS_QUERY,
  SYNC_SERVICE_SOURCE_CODE_MUTATION,
} from "../graphql";

const ACTIVE_BUILD_STATUSES = ["queued", "in_progress"];
const POLL_INTERVAL_MS = 5000;
const SYNC_POLL_INTERVAL_MS = 3000;
// Stop waiting for a sync that never finishes, e.g. when no worker is running
const SYNC_TIMEOUT_MS = 10 * 60 * 1000;

export const isActiveBuild = (build: GqlServiceBuild | undefined) =>
  !!build && ACTIVE_BUILD_STATUSES.includes(build.status);

interface ServiceCommitsProps {
  service: GqlService;
  sourceCode: GqlServiceSourceCode;
}

export const ServiceCommits = ({
  service,
  sourceCode,
}: ServiceCommitsProps) => {
  const { ikApi } = useConfig();
  const { actions, refreshEntity } = useEntityProvider();
  const [pageShas, setPageShas] = useState<string[]>([]);
  const [latestBuilds, setLatestBuilds] = useState<
    Record<string, GqlServiceBuild>
  >({});
  const [startingSha, setStartingSha] = useState<string | null>(null);
  const [logsBuild, setLogsBuild] = useState<GqlServiceBuild | null>(null);

  const isConfigured = !!getImageRepositoryUrl(service.imageResource);
  const canBuild = actions.includes("build");
  const canSync = actions.includes("edit");

  const [syncing, setSyncing] = useState(false);
  const syncStartedFrom = useRef<string | null>(null);

  const startSync = useCallback(async () => {
    syncStartedFrom.current = sourceCode.updatedAt;
    setSyncing(true);
    try {
      await ikApi.graphqlRequest(SYNC_SERVICE_SOURCE_CODE_MUTATION, {
        id: service.id,
      });
    } catch (e) {
      setSyncing(false);
      notifyError(e);
    }
  }, [ikApi, service.id, sourceCode.updatedAt]);

  useEffect(() => {
    if (!syncing) return;
    const deadline = Date.now() + SYNC_TIMEOUT_MS;
    const timer = setInterval(async () => {
      try {
        const response = await ikApi.graphqlRequest<{
          service: {
            sourceCode: { status: string; updatedAt: string } | null;
          } | null;
        }>(SERVICE_SOURCE_CODE_STATUS_QUERY, { id: service.id });
        const current = response.service?.sourceCode;
        const finished =
          !!current &&
          !ACTIVE_BUILD_STATUSES.includes(current.status) &&
          current.updatedAt !== syncStartedFrom.current;
        if (!finished && Date.now() < deadline) return;

        setSyncing(false);
        if (current?.status === "error") {
          notifyError(new Error("Syncing the repository failed, see its logs"));
        } else if (finished) {
          notify("Commits synced", "success");
        }
        refreshEntity?.();
      } catch (e) {
        setSyncing(false);
        notifyError(e);
      }
    }, SYNC_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [syncing, ikApi, service.id, refreshEntity]);

  const loadBuilds = useCallback(
    async (shas: string[]) => {
      if (shas.length === 0) {
        setLatestBuilds({});
        return;
      }
      try {
        const response = await ikApi.graphqlRequest<{
          serviceBuilds: GqlServiceBuild[];
        }>(SERVICE_BUILDS_QUERY, {
          serviceId: service.id,
          commitShas: shas,
          range: [0, 100],
        });
        const latest: Record<string, GqlServiceBuild> = {};
        // Newest first, so the first build seen for a commit is its latest
        for (const build of response.serviceBuilds || []) {
          latest[build.commitSha] ??= build;
        }
        setLatestBuilds(latest);
      } catch (e) {
        notifyError(e);
      }
    },
    [ikApi, service.id],
  );

  const handlePageLoaded = useCallback((commits: GqlSourceCodeCommit[]) => {
    setPageShas(commits.map((commit) => commit.sha));
  }, []);

  useEffect(() => {
    void loadBuilds(pageShas);
  }, [loadBuilds, pageShas]);

  const hasActiveBuild = useMemo(
    () => Object.values(latestBuilds).some(isActiveBuild),
    [latestBuilds],
  );

  useEffect(() => {
    if (!hasActiveBuild) return;
    const timer = setInterval(
      () => void loadBuilds(pageShas),
      POLL_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [hasActiveBuild, loadBuilds, pageShas]);

  const startBuild = useCallback(
    async (commit: GqlSourceCodeCommit) => {
      setStartingSha(commit.sha);
      try {
        await ikApi.graphqlRequest(BUILD_SERVICE_MUTATION, {
          serviceId: service.id,
          commitSha: commit.sha,
        });
        notify(`Build of ${commit.shortSha} queued`, "success");
        await loadBuilds(pageShas);
      } catch (e) {
        notifyError(e);
      } finally {
        setStartingSha(null);
      }
    },
    [ikApi, service.id, loadBuilds, pageShas],
  );

  const disabledReason = !canBuild
    ? "Only service and project owners can build"
    : !isConfigured
      ? "Choose a provisioned ECR resource as the image repository first"
      : null;

  const renderActions = useCallback(
    (commit: GqlSourceCodeCommit) => {
      const build = latestBuilds[commit.sha];
      const active = isActiveBuild(build);
      const reason = disabledReason ?? (active ? "Already building" : null);
      return (
        <div className="flex items-center justify-end gap-1">
          <div className="flex w-9 justify-center">
            {build && (
              <IconButton
                aria-label={`Show logs of the build of ${commit.shortSha}`}
                onClick={() => setLogsBuild(build)}
              >
                <StatusLabel status={build.status} compact />
              </IconButton>
            )}
          </div>
          <Tooltip title={reason}>
            <span>
              <Button
                variant="text"
                loading={startingSha === commit.sha}
                disabled={!!reason}
                onClick={() => void startBuild(commit)}
                aria-label={`Build image at ${commit.shortSha}`}
              >
                {build ? "Rebuild" : "Build"}
              </Button>
            </span>
          </Tooltip>
        </div>
      );
    },
    [latestBuilds, disabledReason, startingSha, startBuild],
  );

  return (
    <>
      {canSync && (
        <div className="mb-2 flex justify-end">
          <Button
            variant="outlined"
            startIcon={<HeroArrowPathIcon fontSize="small" />}
            loading={syncing}
            disabled={syncing}
            onClick={() => void startSync()}
          >
            {syncing ? "Syncing…" : "Sync commits"}
          </Button>
        </div>
      )}
      {!isConfigured && canBuild && (
        <Alert className="mb-2" severity="info">
          Choose a provisioned ECR resource as the image repository in the Image
          Build section to build images from these commits. Its template needs
          the aws_ecr cloud resource type and a repository_url output.
        </Alert>
      )}
      <SourceCodeCommits
        sourceCodeId={sourceCode.id}
        branch={sourceCode.defaultBranch}
        total={sourceCode.commitCount}
        tags={getCommitTags(sourceCode.gitTags, sourceCode.gitTagShas)}
        lastSyncedAt={sourceCode.updatedAt}
        renderActions={renderActions}
        actionsWidth={130}
        onPageLoaded={handlePageLoaded}
      />
      {logsBuild && (
        <LogsDialog
          entityId={logsBuild.id}
          action="build"
          view="logs"
          onClose={() => setLogsBuild(null)}
        />
      )}
    </>
  );
};
