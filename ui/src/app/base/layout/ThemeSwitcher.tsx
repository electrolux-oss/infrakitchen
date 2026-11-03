import * as React from "react";

import {
  ColorSchemeMode,
  Divider,
  HeroCheckIcon,
  HeroMoonIcon,
  HeroSunIcon,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  THEMES,
  Tooltip,
  useColorScheme,
} from "@/index";

const MODES: { value: ColorSchemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function Section({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li role="presentation">
      <div
        id={id}
        className="px-4 pt-1.5 pb-1 text-caption text-fg-muted uppercase"
      >
        {label}
      </div>
      <ul role="group" aria-labelledby={id} className="m-0 list-none p-0">
        {children}
      </ul>
    </li>
  );
}

function Option({
  label,
  checked,
  disabled,
  onSelect,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <MenuItem
      role="menuitemradio"
      aria-checked={checked}
      selected={checked}
      disabled={disabled}
      onClick={onSelect}
    >
      <ListItemIcon className="w-4 [&_svg]:size-4">
        {checked && <HeroCheckIcon />}
      </ListItemIcon>
      <ListItemText>{label}</ListItemText>
    </MenuItem>
  );
}

export default function ThemeSwitcher() {
  const { mode, setMode, theme, setTheme, availableSchemes } = useColorScheme();
  const themeLabel = THEMES.find((option) => option.id === theme)?.label;
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);

  return (
    <>
      <Tooltip title={`Appearance: ${themeLabel}`} enterDelay={1000}>
        <div>
          <IconButton
            className="border-0 bg-transparent hover:bg-transparent [&_svg]:size-4.5"
            size="small"
            aria-label="Appearance"
            aria-haspopup="menu"
            aria-expanded={Boolean(anchor)}
            onClick={(event) => setAnchor(event.currentTarget)}
          >
            <HeroSunIcon className="inline dark:hidden" />
            <HeroMoonIcon className="hidden dark:inline" />
          </IconButton>
        </div>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        className="min-w-40"
      >
        <Section id="appearance-theme" label="Theme">
          {THEMES.map((option) => (
            <Option
              key={option.id}
              label={option.label}
              checked={theme === option.id}
              onSelect={() => setTheme(option.id)}
            />
          ))}
        </Section>
        <Divider className="my-1" />
        <Section id="appearance-mode" label="Mode">
          {MODES.map((option) => (
            <Option
              key={option.value}
              label={option.label}
              checked={mode === option.value}
              disabled={
                option.value === "system"
                  ? availableSchemes.length < 2
                  : !availableSchemes.includes(option.value)
              }
              onSelect={() => setMode(option.value)}
            />
          ))}
        </Section>
      </Menu>
    </>
  );
}
