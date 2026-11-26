import { useCallback, useEffect, useState } from "react";

import { useConfig } from "../../common";
import { ANNOUNCEMENT_COLORS } from "../../common/announcementColors";
import { BaseCard } from "../../common/components/cards/BaseCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { HeroCheckIcon } from "../../icons";
import { Button, Switch, TextField } from "../../ui";
import { cn } from "../../utils/cn";
import {
  GENERAL_SETTINGS_QUERY,
  UPDATE_GENERAL_SETTINGS_MUTATION,
} from "../graphql";

interface GeneralSettings {
  name: string;
  bannerEnabled: boolean;
  bannerMessage: string;
  bannerColor: string;
}

// the same limits as the server
const MAX_NAME_LENGTH = 64;
const MAX_BANNER_LENGTH = 500;

const EMPTY_SETTINGS: GeneralSettings = {
  name: "",
  bannerEnabled: false,
  bannerMessage: "",
  bannerColor: "blue",
};

export const GeneralSettingsSection = () => {
  const { ikApi, refreshGlobalConfig, setGeneralSettingsPreview } = useConfig();
  const [saved, setSaved] = useState<GeneralSettings>(EMPTY_SETTINGS);
  const [name, setName] = useState("");
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerColor, setBannerColor] = useState("blue");
  const [loading, setLoading] = useState(true);

  const apply = useCallback((settings: GeneralSettings) => {
    setSaved(settings);
    setName(settings.name);
    setBannerEnabled(settings.bannerEnabled);
    setBannerMessage(settings.bannerMessage);
    setBannerColor(settings.bannerColor);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await ikApi.graphqlRequest<{
          generalSettings: GeneralSettings;
        }>(GENERAL_SETTINGS_QUERY);
        apply(result.generalSettings);
      } catch (error: any) {
        notifyError(error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [ikApi, apply]);

  const trimmedName = name.trim();
  const trimmedBanner = bannerMessage.trim();
  const nameValid = trimmedName.length <= MAX_NAME_LENGTH;
  const bannerValid = trimmedBanner.length <= MAX_BANNER_LENGTH;
  const changed =
    trimmedName !== saved.name ||
    bannerEnabled !== saved.bannerEnabled ||
    trimmedBanner !== saved.bannerMessage ||
    bannerColor !== saved.bannerColor;

  // preview the unsaved values in the header and the banner while typing; leaving the page drops it
  useEffect(() => {
    setGeneralSettingsPreview?.(
      changed
        ? {
            name: trimmedName.slice(0, MAX_NAME_LENGTH),
            announcement: bannerEnabled
              ? trimmedBanner.slice(0, MAX_BANNER_LENGTH)
              : "",
            announcementColor: bannerColor,
          }
        : null,
    );
  }, [
    changed,
    trimmedName,
    trimmedBanner,
    bannerEnabled,
    bannerColor,
    setGeneralSettingsPreview,
  ]);
  useEffect(
    () => () => setGeneralSettingsPreview?.(null),
    [setGeneralSettingsPreview],
  );

  const handleSave = async () => {
    try {
      setLoading(true);
      const result = await ikApi.graphqlRequest<{
        updateGeneralSettings: GeneralSettings;
      }>(UPDATE_GENERAL_SETTINGS_MUTATION, {
        input: {
          name: trimmedName,
          bannerEnabled,
          bannerMessage: trimmedBanner,
          bannerColor,
        },
      });
      apply(result.updateGeneralSettings);
      await refreshGlobalConfig?.();
      notify("General settings updated successfully", "success");
    } catch (error: any) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseCard
      name="General"
      description="General settings for this instance."
      className="mt-8"
      actions={
        <Button
          variant="contained"
          size="medium"
          onClick={handleSave}
          disabled={loading || !changed || !nameValid || !bannerValid}
        >
          Save
        </Button>
      }
    >
      <div className="col-span-full flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-subtitle1 font-semibold text-fg">Instance</h3>
          <TextField
            label="Instance name"
            value={name}
            disabled={loading}
            error={!nameValid}
            helperText={
              nameValid
                ? "Tells this instance apart from others, for example production or staging. Shown in the header and the browser tab title."
                : `Use at most ${MAX_NAME_LENGTH} characters.`
            }
            onChange={(event) => setName(event.target.value)}
          />
        </section>

        <section className="flex flex-col gap-3 border-t border-divider pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="m-0 text-subtitle1 font-semibold text-fg">
                Announcement banner
              </h3>
              <p className="m-0 mt-1 text-caption text-fg-muted">
                Displayed at the top of every page for all users, for example
                planned maintenance. Users can close it, and it comes back when
                the message changes.
              </p>
            </div>
            <Switch
              checked={bannerEnabled}
              disabled={loading}
              aria-label="Show the announcement banner"
              onChange={(event) => setBannerEnabled(event.target.checked)}
            />
          </div>
          {/* The message and color are kept while the banner is off, for the next time it is turned on */}
          <div
            className={cn(
              "flex flex-col gap-4 border-l-2 border-divider pl-4 transition-opacity",
              !bannerEnabled && "opacity-50",
            )}
          >
            <TextField
              label="Announcement message"
              value={bannerMessage}
              multiline
              minRows={2}
              disabled={loading || !bannerEnabled}
              error={!bannerValid}
              helperText={
                bannerValid
                  ? `${trimmedBanner.length}/${MAX_BANNER_LENGTH}`
                  : `Use at most ${MAX_BANNER_LENGTH} characters.`
              }
              onChange={(event) => setBannerMessage(event.target.value)}
            />
            <div>
              <span
                id="banner-color-label"
                className="block text-body2 text-fg"
              >
                Banner color
              </span>
              <div
                role="radiogroup"
                aria-labelledby="banner-color-label"
                className="mt-2 flex gap-2.5"
              >
                {ANNOUNCEMENT_COLORS.map((color) => {
                  const selected = color.value === bannerColor;
                  return (
                    <button
                      key={color.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={color.label}
                      title={color.label}
                      disabled={loading || !bannerEnabled}
                      onClick={() => setBannerColor(color.value)}
                      className={cn(
                        "flex size-6 cursor-pointer items-center justify-center rounded-full border-2 transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50",
                        color.swatch,
                        selected
                          ? "ring-2 ring-fg ring-offset-0"
                          : "ring-1 ring-divider hover:ring-fg-muted",
                      )}
                    >
                      {selected ? <HeroCheckIcon className="size-3.5" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </BaseCard>
  );
};
