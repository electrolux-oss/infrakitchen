import * as React from "react";

import {
  DarkModeIcon,
  LightModeIcon,
  IconButton,
  Tooltip,
  useColorScheme,
} from "@/index";

export default function ThemeSwitcher() {
  const { resolvedMode: paletteMode, setMode } = useColorScheme();

  const toggleMode = React.useCallback(() => {
    setMode(paletteMode === "dark" ? "light" : "dark");
  }, [setMode, paletteMode]);

  return (
    <Tooltip
      title={`${paletteMode === "dark" ? "Light" : "Dark"} mode`}
      enterDelay={1000}
    >
      <div>
        <IconButton
          className="border-0 bg-transparent hover:bg-transparent"
          size="small"
          aria-label={`Switch to ${paletteMode === "dark" ? "light" : "dark"} mode`}
          onClick={toggleMode}
        >
          <LightModeIcon className="inline dark:hidden" />
          <DarkModeIcon className="hidden dark:inline" />
        </IconButton>
      </div>
    </Tooltip>
  );
}
