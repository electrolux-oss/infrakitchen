import { useCallback, useEffect, useState } from "react";

import { useConfig } from "../../common";
import { BaseCard } from "../../common/components/cards/BaseCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { Button, FormControlLabel, Switch, TextField } from "../../ui";
import {
  DRIFT_SETTINGS_QUERY,
  UPDATE_DRIFT_SETTINGS_MUTATION,
} from "../graphql";

interface DriftSettings {
  enabled: boolean;
  intervalHours: number;
}

const DEFAULT_SETTINGS: DriftSettings = {
  enabled: false,
  intervalHours: 24,
};

export const DriftSettingsSection = () => {
  const { ikApi } = useConfig();
  const [saved, setSaved] = useState<DriftSettings>(DEFAULT_SETTINGS);
  const [enabled, setEnabled] = useState(DEFAULT_SETTINGS.enabled);
  const [intervalHours, setIntervalHours] = useState(
    String(DEFAULT_SETTINGS.intervalHours),
  );
  const [loading, setLoading] = useState(true);

  const apply = useCallback((settings: DriftSettings) => {
    setSaved(settings);
    setEnabled(settings.enabled);
    setIntervalHours(String(settings.intervalHours));
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
  // the same limit as the server: up to a year
  const intervalValid = Number.isInteger(hours) && hours >= 1 && hours <= 8760;
  const changed = enabled !== saved.enabled || hours !== saved.intervalHours;

  const handleSave = async () => {
    try {
      setLoading(true);
      const result = await ikApi.graphqlRequest<{
        updateDriftSettings: DriftSettings;
      }>(UPDATE_DRIFT_SETTINGS_MUTATION, {
        input: { enabled, intervalHours: hours },
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
          disabled={loading || !changed || !intervalValid}
        >
          Save
        </Button>
      }
    >
      <div className="col-span-full flex flex-col gap-3">
        <div>
          <FormControlLabel
            className="-ml-[3.5px]"
            control={
              <Switch
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
        {/* Shown while disabled too: projects that turn drift detection on use these values */}
        <TextField
          label="Check every (hours)"
          type="number"
          value={intervalHours}
          disabled={loading}
          error={!intervalValid}
          helperText={
            intervalValid
              ? "A resource is checked again this many hours after its last check or apply. Also used by the projects that enable drift detection."
              : "Enter a whole number of hours, from 1 to 8760."
          }
          onChange={(event) => setIntervalHours(event.target.value)}
        />
        <span className="block text-caption text-fg-muted">
          A check plans the resource and reports what an apply would change, so
          only resources without pending changes (DONE) are checked. Resources
          never checked go first, then the least recently checked or applied.
          Only a few checks run at once, and they wait for the tasks users
          start.
        </span>
      </div>
    </BaseCard>
  );
};
