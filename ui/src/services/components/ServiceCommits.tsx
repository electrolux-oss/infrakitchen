import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { StatusLabel } from "../../common/components/labels";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { CODE_FONT_FAMILY } from "../../common/theme";
import { HeroArrowPathIcon } from "../../icons";
import {
  getCommitTags,
  SourceCodeCommits,
} from "../../source_codes/components/SourceCodeCommits";
import { GqlSourceCodeCommit } from "../../source_codes/graphql";
import {
  Button,
  DataTableColumn,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  RenderCellParams,
  TextField,
  Tooltip,
} from "../../ui";
import {
  BUILD_SERVICE_MUTATION,
  GqlService,
  GqlServiceBuild,
  GqlServiceSourceCode,
  SERVICE_BUILDS_QUERY,
  SERVICE_SOURCE_CODE_STATUS_QUERY,
  SYNC_SERVICE_SOURCE_CODE_MUTATION,
} from "../graphql";

import { IMAGE_TAG_RE, isActiveBuild, isActiveStatus } from "./builds";
import { ServiceCommitBuildsDialog } from "./ServiceCommitBuildsDialog";

const POLL_INTERVAL_MS = 5000;
const SYNC_POLL_INTERVAL_MS = 3000;
const SYNC_TIMEOUT_MS = 10 * 60 * 1000;
const BUILDS_PER_PAGE = 500;

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
  const [buildsBySha, setBuildsBySha] = useState<
    Record<string, GqlServiceBuild[]>
  >({});
  const [startingSha, setStartingSha] = useState<string | null>(null);
  const [buildCommit, setBuildCommit] = useState<GqlSourceCodeCommit | null>(
    null,
  );
  const [buildsCommit, setBuildsCommit] = useState<GqlSourceCodeCommit | null>(
    null,
  );

  const isConfigured =
    !!service.registryIntegration && !!service.imageRepository;
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
      notify("Commit sync started", "info");
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
          !isActiveStatus(current.status) &&
          current.updatedAt !== syncStartedFrom.current;
        if (!finished && Date.now() < deadline) return;

        setSyncing(false);
        if (current?.status === "error") {
          notifyError(new Error("Syncing the repository failed, see its logs"));
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
        setBuildsBySha({});
        return;
      }
      try {
        const response = await ikApi.graphqlRequest<{
          serviceBuilds: GqlServiceBuild[];
        }>(SERVICE_BUILDS_QUERY, {
          serviceId: service.id,
          commitShas: shas,
          range: [0, BUILDS_PER_PAGE],
        });
        const bySha: Record<string, GqlServiceBuild[]> = {};
        for (const build of response.serviceBuilds || []) {
          (bySha[build.commitSha] ??= []).push(build);
        }
        setBuildsBySha(bySha);
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
    () =>
      Object.values(buildsBySha).some((builds) => builds.some(isActiveBuild)),
    [buildsBySha],
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
    async (commit: GqlSourceCodeCommit, tag: string) => {
      setStartingSha(commit.sha);
      try {
        await ikApi.graphqlRequest(BUILD_SERVICE_MUTATION, {
          serviceId: service.id,
          commitSha: commit.sha,
          tag,
        });
        notify(`Build of ${commit.shortSha} as ${tag} queued`, "success");
        setBuildCommit(null);
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
      ? "Choose the image registry and repository first"
      : null;

  const imageColumns: DataTableColumn<GqlSourceCodeCommit>[] = useMemo(
    () => [
      {
        field: "images",
        headerName: "Image",
        width: 220,
        sortable: false,
        renderCell: (params: RenderCellParams<GqlSourceCodeCommit>) => {
          const commit = params.row;
          const builds = buildsBySha[commit.sha];
          if (!builds?.length) return null;
          const latest = builds[0];
          const others = builds.length - 1;
          return (
            <button
              type="button"
              className="flex max-w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-surface border-0 bg-transparent p-1 text-left text-inherit hover:bg-hover"
              aria-label={`Show images built from ${commit.shortSha}`}
              onClick={() => setBuildsCommit(commit)}
            >
              <StatusLabel status={latest.status} compact />
              <span
                className="truncate"
                style={{ fontFamily: CODE_FONT_FAMILY }}
              >
                {latest.tag}
              </span>
              {others > 0 && (
                <span className="shrink-0 text-body2 text-fg-muted">
                  +{others}
                </span>
              )}
            </button>
          );
        },
      },
    ],
    [buildsBySha],
  );

  const renderActions = useCallback(
    (commit: GqlSourceCodeCommit) => {
      const builds = buildsBySha[commit.sha] ?? [];
      const built = builds.length > 0;
      const active = builds.some(isActiveBuild);
      const reason = disabledReason ?? (active ? "Already building" : null);
      return (
        <Tooltip title={reason}>
          <span>
            <Button
              variant="text"
              loading={startingSha === commit.sha}
              disabled={!!reason}
              onClick={() => setBuildCommit(commit)}
              aria-label={`Build image at ${commit.shortSha}`}
            >
              {built ? "Rebuild" : "Build"}
            </Button>
          </span>
        </Tooltip>
      );
    },
    [buildsBySha, disabledReason, startingSha],
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
      <SourceCodeCommits
        sourceCodeId={sourceCode.id}
        branch={sourceCode.defaultBranch}
        total={sourceCode.commitCount}
        tags={getCommitTags(sourceCode.gitTags, sourceCode.gitTagShas)}
        lastSyncedAt={sourceCode.updatedAt}
        extraColumns={imageColumns}
        renderActions={renderActions}
        actionsWidth={100}
        onPageLoaded={handlePageLoaded}
      />
      {buildsCommit && (
        <ServiceCommitBuildsDialog
          commit={buildsCommit}
          builds={buildsBySha[buildsCommit.sha] ?? []}
          onClose={() => setBuildsCommit(null)}
        />
      )}
      {buildCommit && (
        <BuildTagDialog
          commit={buildCommit}
          imageRepository={service.imageRepository ?? ""}
          loading={startingSha === buildCommit.sha}
          onClose={() => setBuildCommit(null)}
          onBuild={(tag) => void startBuild(buildCommit, tag)}
        />
      )}
    </>
  );
};

interface BuildTagDialogProps {
  commit: GqlSourceCodeCommit;
  imageRepository: string;
  loading: boolean;
  onClose: () => void;
  onBuild: (tag: string) => void;
}

const BuildTagDialog = ({
  commit,
  imageRepository,
  loading,
  onClose,
  onBuild,
}: BuildTagDialogProps) => {
  const [tag, setTag] = useState(commit.sha);
  const trimmed = tag.trim();
  const invalid = !IMAGE_TAG_RE.test(trimmed);

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Build {commit.shortSha}</DialogTitle>
      <DialogContent>
        <TextField
          label="Image tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !invalid && !loading) onBuild(trimmed);
          }}
          error={trimmed !== "" && invalid}
          helperText={
            invalid
              ? "Letters, digits, '_', '.' and '-', not starting with '.' or '-', at most 128 characters"
              : `Pushed as ${imageRepository}:${trimmed}. A tag can only be pushed once.`
          }
          fullWidth
          margin="normal"
          autoFocus
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          loading={loading}
          disabled={invalid}
          onClick={() => onBuild(trimmed)}
        >
          Build
        </Button>
      </DialogActions>
    </Dialog>
  );
};
