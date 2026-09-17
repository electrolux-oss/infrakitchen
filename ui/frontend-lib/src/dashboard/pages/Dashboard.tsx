import RefreshIcon from "@mui/icons-material/Refresh";
import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";

import PageContainer from "../../common/PageContainer";
import { GoldenStateWidget } from "../../golden_state/GoldenStateWidget";
import { GettingStartedContent } from "../components/GettingStarted";
import { MyFavoritesWidget } from "../components/MyFavoritesWidget";
import { RecentActivityWidget } from "../components/RecentActivityWidget";
import { useDashboardData } from "../useDashboardData";

export const DashboardPage = () => {
  const {
    favorites,
    activities,
    activitiesTotal,
    loadingMore,
    goldenStateReport,
    hasResources,
    loading,
    refreshing,
    refetch,
    loadMoreActivities,
  } = useDashboardData();

  if (!loading && !hasResources) {
    return (
      <PageContainer
        title="Welcome"
        description="Let's get your platform set up. Complete the steps below to start managing your infrastructure and services."
      >
        <GettingStartedContent />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={
        <>
          <Typography
            variant="h5"
            component="h1"
            color="primary"
            sx={{ fontWeight: 600 }}
          >
            Dashboard
          </Typography>
        </>
      }
      description="A quick overview of your infrastructure and recent activities"
      actions={
        <Tooltip title="Refresh">
          <IconButton
            size="small"
            sx={{ p: 0.75 }}
            aria-label="Refresh"
            onClick={() => void refetch()}
            disabled={refreshing}
          >
            {refreshing ? (
              <CircularProgress size={16} />
            ) : (
              <RefreshIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      }
    >
      {" "}
      <Box sx={{ width: "100%", mb: 3 }}>
        <GoldenStateWidget
          goldenStateReport={goldenStateReport}
          loading={loading}
          expandable
        />
      </Box>
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
          loadingMore={loadingMore}
          hasFavorites={favorites.length > 0}
          total={activitiesTotal}
          onLoadMore={loadMoreActivities}
        />
      </Box>
    </PageContainer>
  );
};

DashboardPage.path = "/";
