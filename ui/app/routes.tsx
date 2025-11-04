import { Navigate, Outlet, useLocation, useNavigate } from "react-router";

import { GradientCircularProgress } from "@electrolux-oss/infrakitchen";
import { Box } from "@mui/material";

import { useAuth } from "./base/auth/AuthContext";

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const redirectPath = location.pathname + location.search;
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <GradientCircularProgress />
      </Box>
    );
  }

  if (user && !loading) {
    const storedRedirectPath = localStorage.getItem("redirectPath");
    if (storedRedirectPath) {
      localStorage.removeItem("redirectPath");
      navigate(storedRedirectPath, { replace: true });
      return null;
    } else {
      return <Outlet />;
    }
  }

  localStorage.setItem("redirectPath", redirectPath);
  return (
    <Navigate
      to={`/login?redirect=${encodeURIComponent(redirectPath)}`}
      replace
    />
  );
};

export default ProtectedRoute;
