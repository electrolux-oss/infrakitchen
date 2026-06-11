import React, { useState } from "react";

import { useEffectOnce } from "react-use";

import { notify } from "@electrolux-oss/infrakitchen";
import { Icon } from "@iconify/react";
import { CircularProgress, Menu, MenuItem } from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiCard from "@mui/material/Card";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

import { useAuth } from "../../base/auth/AuthContext";

const Card = styled(MuiCard)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignSelf: "center",
  width: "100%",
  padding: theme.spacing(4),
  gap: theme.spacing(2),
  boxShadow:
    "hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px",
  [theme.breakpoints.up("sm")]: {
    width: "520px",
  },
  ...theme.applyStyles("dark", {
    boxShadow:
      "hsla(220, 30%, 5%, 0.5) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.08) 0px 15px 35px -5px",
  }),
}));

export default function SignInCard() {
  const [loading, setLoading] = useState(false);
  const [enabledProviders, setEnabledProviders] = useState<string[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleGuestClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleGuestSelect = (type: string) => {
    setAnchorEl(null);
    handleSubmit(type);
  };

  const handleClose = () => {
    setAnchorEl(null); // Explicit close
  };

  const { login } = useAuth();

  const handleSubmit = (provider: string) => {
    setLoading(true);
    login(provider).catch((error: Error) => {
      setLoading(false);
      notify(error?.message || "Login failed. Please try again.", "error");
    });
  };

  useEffectOnce(() => {
    fetch("/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "{ enabledAuthProviders }",
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        setEnabledProviders(json?.data?.enabledAuthProviders || []);
      })
      .catch(() => {
        setEnabledProviders([]);
      });
  });

  return (
    <Card variant="outlined">
      <Typography
        component="h1"
        variant="h4"
        sx={{ width: "100%", fontSize: "clamp(2rem, 10vw, 1rem)" }}
      >
        Welcome to InfraKitchen
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {enabledProviders.includes("microsoft") && (
          <Button
            variant="outlined"
            type="submit"
            disabled={loading}
            fullWidth
            sx={{
              gap: "1rem",
              justifyContent: "flex-start",
            }}
            onClick={() => handleSubmit("microsoft")}
          >
            {loading && <CircularProgress size={25} thickness={2} />}
            <Icon icon="logos:microsoft-icon" width={24} height={24} />
            Log in with Microsoft
          </Button>
        )}
        {enabledProviders.includes("github") && (
          <Button
            variant="outlined"
            type="submit"
            disabled={loading}
            fullWidth
            sx={{
              gap: "1rem",
              justifyContent: "flex-start",
            }}
            onClick={() => handleSubmit("github")}
          >
            {loading && <CircularProgress size={25} thickness={2} />}
            <Icon icon="octicon:mark-github-24" width={24} height={24} />
            Log in with GitHub
          </Button>
        )}
        {enabledProviders.includes("guest") && (
          <Button
            variant="outlined"
            disabled={loading}
            fullWidth
            sx={{
              gap: "1rem",
              justifyContent: "flex-start",
            }}
            onClick={handleGuestClick}
          >
            <Icon icon="ic:baseline-account-circle" width={24} height={24} />
            Log in as a Guest
          </Button>
        )}
        {open && (
          <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "left",
            }}
            slotProps={{
              paper: {
                sx: {
                  width: anchorEl ? anchorEl.offsetWidth : undefined,
                },
              },
            }}
          >
            <MenuItem onClick={() => handleGuestSelect("guest_default")}>
              Guest Login (Default User)
            </MenuItem>
            <MenuItem onClick={() => handleGuestSelect("guest_infra")}>
              Guest Login (Infra Admin)
            </MenuItem>
            <MenuItem onClick={() => handleGuestSelect("guest_super")}>
              Guest Login (Super User)
            </MenuItem>
          </Menu>
        )}
      </Box>
    </Card>
  );
}
