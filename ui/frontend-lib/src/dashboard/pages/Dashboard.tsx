import RefreshIcon from "@mui/icons-material/Refresh";
import CircularProgress from "@mui/material/CircularProgress";
import { Box, Typography, IconButton, Tooltip } from "@mui/material";

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
      <PageContainer>
        <Box sx={{ mb: 4, width: "80%", maxWidth: 1000 }}>
          <Box>
            {" "}
            <Typography
              variant="h5"
              component="h1"
              gutterBottom
              sx={{ fontWeight: 600 }}
            >
              Dashboard
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "text.secondary",
                mb: 6,
              }}
            >
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
