import { Outlet } from "react-router";

import { useColorScheme } from "@mui/material/styles";
import { Toaster } from "sonner";

export const RouterSnackbarWrapper = () => {
  const { mode } = useColorScheme();
  return (
    <>
      <Toaster
        id="global"
        position="top-right"
        richColors
        closeButton
        theme={mode ?? "system"}
        visibleToasts={5}
        style={{ ["--width" as any]: "520px" }}
        toastOptions={{
          style: { fontSize: "0.95rem", padding: "16px" },
        }}
      />
      <Toaster
        id="errors"
        position="bottom-right"
        theme={mode ?? "system"}
        visibleToasts={3}
        style={{ ["--width" as any]: "520px" }}
        toastOptions={{
          style: { fontSize: "0.95rem", padding: "16px" },
        }}
      />
      <Outlet />
    </>
  );
};
