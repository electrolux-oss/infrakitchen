import { useState } from "react";

import RefreshIcon from "@mui/icons-material/Refresh";
import { Box, Typography, Button, CircularProgress } from "@mui/material";

import PageContainer from "../../common/PageContainer";
import { GettingStartedContent } from "../components/GettingStarted";
import { MyFavoritesWidget } from "../components/MyFavoritesWidget";
import { RecentActivityWidget } from "../components/RecentActivityWidget";
import { useDashboardData } from "../useDashboardData";

export const DashboardPage = () => {
  const { favorites, activities, hasResources, loading, refetch } =
    useDashboardData();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!refreshing) {
      setRefreshing(true);
      try {
        await refetch();
      } finally {
        setRefreshing(false);
      }
    }
  };

  if (!loading && !hasResources) {
    return (
      <PageContainer>
        <Box sx={{ mb: 4, width: "80%", maxWidth: 1000 }}>
          <Box>
            <Typography
              variant="h4"
              component="h1"
              color="primary"
              gutterBottom
            >
              Welcome to InfraKitchen
            </Typography>
            <Typography variant="body1" color="text.secondary" mb={6}>
              Streamline your infrastructure management with our powerful
              platform for composing, deploying, and managing infrastructure as
              code.
            </Typography>
          </Box>
          <GettingStartedContent />
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={
        <>
          <Typography
            variant="h4"
            component="h1"
            color="primary"
            fontWeight={600}
          >
            Welcome to InfraKitchen
          </Typography>
        </>
      }
      description="Here's what's happening with your infrastructure"
      actions={
        <Button
          size="small"
          variant="outlined"
          startIcon={
            refreshing ? <CircularProgress size={16} /> : <RefreshIcon />
          }
          onClick={handleRefresh}
          disabled={refreshing || loading}
        >
          Refresh
        </Button>
      }
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(300px, 30%) 1fr",
          gap: 3,
          alignItems: "start",
          width: "100%",
        }}
      >
        <MyFavoritesWidget favorites={favorites} loading={loading} />
        <RecentActivityWidget
          activities={activities}
          loading={loading}
          hasFavorites={favorites.length > 0}
        />
      </Box>
    </PageContainer>
  );
};

DashboardPage.path = "/";
