import { useCallback, useEffect, useState } from "react";

import { useConfig } from "../../common";
import { BaseCard } from "../../common/components/cards/BaseCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { Button, Checkbox, FormControlLabel, TextField } from "../../ui";
import {
  DRIFT_SETTINGS_QUERY,
  UPDATE_DRIFT_SETTINGS_MUTATION,
} from "../graphql";

interface DriftSettings {
  enabled: boolean;
  intervalHours: number;
  batchSize: number;
}

const DEFAULT_SETTINGS: DriftSettings = {
  enabled: false,
  intervalHours: 24,
  batchSize: 20,
};

export const DriftSettingsSection = () => {
  const { ikApi } = useConfig();
  const [saved, setSaved] = useState<DriftSettings>(DEFAULT_SETTINGS);
  const [enabled, setEnabled] = useState(DEFAULT_SETTINGS.enabled);
  const [intervalHours, setIntervalHours] = useState(
    String(DEFAULT_SETTINGS.intervalHours),
  );
  const [batchSize, setBatchSize] = useState(
    String(DEFAULT_SETTINGS.batchSize),
  );
  const [loading, setLoading] = useState(true);

  const apply = useCallback((settings: DriftSettings) => {
    setSaved(settings);
    setEnabled(settings.enabled);
    setIntervalHours(String(settings.intervalHours));
    setBatchSize(String(settings.batchSize));
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await ikApi.graphqlRequest<{
          driftSettings: DriftSettings;
        }>(DRIFT_SETTINGS_QUERY);
        apply(result.driftSettings);
      } catch (error: any) {
        notifyError(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [ikApi, apply]);

  const hours = Number(intervalHours);
  const intervalValid = Number.isInteger(hours) && hours >= 1;
  const batch = Number(batchSize);
  const batchValid = Number.isInteger(batch) && batch >= 1 && batch <= 1000;
  const changed =
    enabled !== saved.enabled ||
    hours !== saved.intervalHours ||
    batch !== saved.batchSize;

  const handleSave = async () => {
    try {
      setLoading(true);
      const result = await ikApi.graphqlRequest<{
        updateDriftSettings: DriftSettings;
      }>(UPDATE_DRIFT_SETTINGS_MUTATION, {
        input: { enabled, intervalHours: hours, batchSize: batch },
      });
      apply(result.updateDriftSettings);
      notify("Drift detection settings updated successfully", "success");
    } catch (error: any) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseCard
      name="Drift Detection"
      description="Regularly compare the real infrastructure with the state of provisioned resources. Projects can also enable it on their own."
      className="mt-8"
      actions={
        <Button
          variant="contained"
          size="medium"
          onClick={handleSave}
          disabled={
            loading || !changed || (enabled && !(intervalValid && batchValid))
          }
        >
          Save
        </Button>
      }
    >
      <div className="col-span-full flex flex-col gap-3">
        <div>
          <FormControlLabel
            control={
              <Checkbox
                checked={enabled}
                disabled={loading}
                onChange={(event) => setEnabled(event.target.checked)}
              />
            }
            label="Enable drift detection for all resources"
          />
          <span className="block text-caption text-fg-muted">
            When disabled, only resources of projects that enabled drift
            detection are checked.
          </span>
        </div>
        {enabled && (
          <>
            <TextField
              label="Check every (hours)"
              type="number"
              value={intervalHours}
              disabled={loading}
              error={!intervalValid}
              helperText={
                intervalValid
                  ? "A resource is checked again after this many hours. Also used by the projects that enable drift detection."
                  : "Enter a whole number of hours, 1 or more."
              }
              onChange={(event) => setIntervalHours(event.target.value)}
            />
            <TextField
              label="Checks per run"
              type="number"
              value={batchSize}
              disabled={loading}
              error={!batchValid}
              helperText={
                batchValid
                  ? "Resources queued every 15 minutes, least recently checked first. Raise it if resources are not checked within the interval."
                  : "Enter a whole number from 1 to 1000."
              }
              onChange={(event) => setBatchSize(event.target.value)}
            />
          </>
        )}
      </div>
    </BaseCard>
  );
};
