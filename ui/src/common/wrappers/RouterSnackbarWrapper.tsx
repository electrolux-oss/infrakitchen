import { Outlet } from "react-router";

import { Toaster } from "sonner";

import { useColorScheme } from "../../ui";

export const RouterSnackbarWrapper = () => {
  const { resolvedMode } = useColorScheme();
  return (
    <>
      <Toaster
        id="global"
        position="top-right"
        richColors
        closeButton
        theme={resolvedMode}
        visibleToasts={5}
        style={{ ["--width" as any]: "520px" }}
        toastOptions={{
          style: { fontSize: "0.95rem", padding: "16px" },
        }}
      />
      <Toaster
        id="errors"
        position="bottom-right"
        richColors
        closeButton
        theme={resolvedMode}
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
