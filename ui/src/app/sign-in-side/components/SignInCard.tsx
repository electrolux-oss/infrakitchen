import React, { useState } from "react";

import { Icon } from "@iconify/react";
import icBaselineAccountCircleData from "@iconify-icons/ic/baseline-account-circle";
import logosGoogleIconData from "@iconify-icons/logos/google-icon";
import logosMicrosoftIconData from "@iconify-icons/logos/microsoft-icon";
import octiconMarkGithub24Data from "@iconify-icons/octicon/mark-github-24";

import { useAuth } from "../../base/auth/AuthContext";

import {
  notify,
  useEffectOnce,
  Spinner,
  Button,
  Menu,
  MenuItem,
  Card,
} from "@/index";

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
    <Card
      variant="outlined"
      className="flex w-full flex-col gap-4 self-center p-8 shadow-[hsla(220,30%,5%,0.05)_0px_5px_15px_0px,hsla(220,25%,10%,0.05)_0px_15px_35px_-5px] sm:w-[520px] dark:shadow-[hsla(220,30%,5%,0.5)_0px_5px_15px_0px,hsla(220,25%,10%,0.08)_0px_15px_35px_-5px]"
    >
      <h1 className="m-0 w-full text-h5">Welcome to InfraKitchen</h1>
      <div className="flex flex-col gap-4">
        {enabledProviders.includes("microsoft") && (
          <Button
            className="justify-start gap-4"
            variant="outlined"
            type="submit"
            disabled={loading}
            fullWidth
            onClick={() => handleSubmit("microsoft")}
          >
            {loading && <Spinner size={25} />}
            <Icon icon={logosMicrosoftIconData} ssr width={24} height={24} />
            Log in with Microsoft
          </Button>
        )}
        {enabledProviders.includes("github") && (
          <Button
            className="justify-start gap-4"
            variant="outlined"
            type="submit"
            disabled={loading}
            fullWidth
            onClick={() => handleSubmit("github")}
          >
            {loading && <Spinner size={25} />}
            <Icon icon={octiconMarkGithub24Data} ssr width={24} height={24} />
            Log in with GitHub
          </Button>
        )}
        {enabledProviders.includes("google") && (
          <Button
            className="justify-start gap-4"
            variant="outlined"
            type="submit"
            disabled={loading}
            fullWidth
            onClick={() => handleSubmit("google")}
          >
            {loading && <Spinner size={25} />}
            <Icon icon={logosGoogleIconData} ssr width={24} height={24} />
            Log in with Google
          </Button>
        )}
        {enabledProviders.includes("guest") && (
          <Button
            className="justify-start gap-4"
            variant="outlined"
            disabled={loading}
            fullWidth
            onClick={handleGuestClick}
          >
            <Icon
              icon={icBaselineAccountCircleData}
              ssr
              width={24}
              height={24}
            />
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
            matchAnchorWidth
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
      </div>
    </Card>
  );
}
