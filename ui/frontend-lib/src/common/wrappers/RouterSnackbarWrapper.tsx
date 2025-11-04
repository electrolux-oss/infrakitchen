import { Outlet } from "react-router";

import { SnackbarProvider } from "notistack";

export const RouterSnackbarWrapper = () => {
  return (
    <SnackbarProvider maxSnack={5} preventDuplicate>
      <Outlet />
    </SnackbarProvider>
  );
};
