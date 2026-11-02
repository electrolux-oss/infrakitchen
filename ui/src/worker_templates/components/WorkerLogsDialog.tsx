import { useCallback, useEffect, useRef, useState } from "react";

import { useConfig } from "../../common/context";
import { LogLine } from "../../common/LogsComponent/LogLine";
import { HeroChevronDoubleDownIcon } from "../../icons";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "../../ui";
import { GqlWorkerInstanceLogs } from "../graphql";

/**
 * Container or pod logs of a worker. `query` returns `{ logs, error }` under `resultKey`.
 * The dialog is open while `title` is set.
 */
export const WorkerLogsDialog = ({
  title,
  query,
  variables,
  resultKey,
  onClose,
}: {
  title: string | null;
  query: string;
  variables: Record<string, unknown>;
  resultKey: string;
  onClose: () => void;
}) => {
  const { ikApi } = useConfig();
  const [logs, setLogs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const variablesKey = JSON.stringify(variables);

  const load = useCallback(async () => {
    if (title === null) return;
    setLoading(true);
    try {
      const response = await ikApi.graphqlRequest<
        Record<string, GqlWorkerInstanceLogs>
      >(query, { ...JSON.parse(variablesKey), tail: 1000 });
      setLogs(response[resultKey].logs);
      setError(response[resultKey].error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [ikApi, query, variablesKey, resultKey, title]);

  useEffect(() => {
    setLogs("");
    setError(null);
    void load();
  }, [load]);

  return (
    <Dialog open={title !== null} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Logs: {title}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error">{error}</Alert>}
        {!error && !loading && logs === "" && (
          <p className="text-body2 text-fg-muted">No logs.</p>
        )}
        {logs !== "" && (
          <div
            ref={scrollRef}
            className="max-h-[60vh] overflow-auto rounded bg-base-200 p-3 font-mono"
          >
            {logs
              .replace(/\n$/, "")
              .split("\n")
              .map((line, index) => (
                <LogLine key={index} line={line} />
              ))}
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          startIcon={<HeroChevronDoubleDownIcon className="size-4" />}
          onClick={() =>
            scrollRef.current?.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: "smooth",
            })
          }
          disabled={logs === ""}
        >
          Scroll to bottom
        </Button>
        <Button onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
