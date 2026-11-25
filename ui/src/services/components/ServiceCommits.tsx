import { useCallback, useEffect, useRef, useState } from "react";

import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { HeroArrowPathIcon } from "../../icons";
import {
  getCommitTags,
  SourceCodeCommits,
} from "../../source_codes/components/SourceCodeCommits";
import { Button } from "../../ui";
import {
  GqlService,
  GqlServiceSourceCode,
  SERVICE_SOURCE_CODE_STATUS_QUERY,
  SYNC_SERVICE_SOURCE_CODE_MUTATION,
} from "../graphql";

const ACTIVE_SYNC_STATUSES = ["queued", "in_progress"];
const SYNC_POLL_INTERVAL_MS = 3000;
const SYNC_TIMEOUT_MS = 10 * 60 * 1000;

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
          !ACTIVE_SYNC_STATUSES.includes(current.status) &&
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
      />
    </>
  );
};
