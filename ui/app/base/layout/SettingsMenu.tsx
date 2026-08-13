import * as React from "react";

import { useUserSettings } from "@electrolux-oss/infrakitchen";
import SettingsIcon from "@mui/icons-material/Settings";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

export default function SettingsMenu() {
  const { settings, setSetting } = useUserSettings();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const isOpen = Boolean(anchorEl);

  const handleOpen = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget);
    },
    [],
  );

  const handleClose = React.useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleToggleFullWidth = React.useCallback(
    (_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      setSetting("fullWidthPages", checked);
    },
    [setSetting],
  );

  return (
    <React.Fragment>
      <Tooltip title="Page settings" enterDelay={1000}>
        <div>
          <IconButton
            size="small"
            aria-label="Open page settings"
            aria-controls={isOpen ? "page-settings-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={isOpen ? "true" : undefined}
            onClick={handleOpen}
          >
            <SettingsIcon />
          </IconButton>
        </div>
      </Tooltip>
      <Menu
        id="page-settings-menu"
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Stack sx={{ px: 2, py: 1, minWidth: 260 }} spacing={1}>
          <Typography variant="subtitle2">Page settings</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={settings.fullWidthPages}
                onChange={handleToggleFullWidth}
              />
            }
            label="Full width pages"
          />
        </Stack>
      </Menu>
    </React.Fragment>
  );
}
