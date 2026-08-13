import { useCallback, useMemo } from "react";

import { useLocalStorage } from "../context/UIStateContext";

const USER_SETTINGS_STORAGE_KEY = "userSettings";

export interface UserSettings {
  fullWidthPages: boolean;
}

const defaultUserSettings: UserSettings = {
  fullWidthPages: true,
};

export const useUserSettings = () => {
  const { get, setKey } = useLocalStorage<Record<string, UserSettings>>();

  const settings = useMemo(
    () => ({
      ...defaultUserSettings,
      ...(get(USER_SETTINGS_STORAGE_KEY) ?? {}),
    }),
    [get],
  );

  const setSetting = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      setKey(USER_SETTINGS_STORAGE_KEY, {
        ...settings,
        [key]: value,
      });
    },
    [setKey, settings],
  );

  return {
    settings,
    setSetting,
  };
};
