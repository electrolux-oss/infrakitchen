import PageContainer from "../../common/PageContainer";
import { DriftWidget } from "../../drift/DriftWidget";
import { GoldenStateWidget } from "../../golden_state/GoldenStateWidget";
import { HeroArrowPathIcon, HeroChartBarIcon } from "../../icons";
import { Spinner, IconButton, Tooltip } from "../../ui";
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
    driftReport,
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
      title="Dashboard"
      icon={<HeroChartBarIcon />}
      description="A quick overview of your infrastructure and recent activities"
      actions={
        <Tooltip title="Refresh">
          <IconButton
            className="p-1.5"
            size="small"
            aria-label="Refresh"
            onClick={() => void refetch()}
            disabled={refreshing}
          >
            {refreshing ? (
              <Spinner size={16} />
            ) : (
              <HeroArrowPathIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      }
    >
      {" "}
      <div className="mb-6 w-full">
        <GoldenStateWidget
          goldenStateReport={goldenStateReport}
          driftReport={driftReport}
          loading={loading}
          expandable
        />
      </div>
      <div className="mb-6 w-full empty:hidden">
        <DriftWidget driftReport={driftReport} />
      </div>
      <div
        // Stack the widgets on small screens; side by side from md up.
        className="grid w-full grid-cols-[minmax(0,_1fr)] items-start gap-6 md:grid-cols-[minmax(300px,_30%)_minmax(0,_1fr)]"
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
      </div>
    </PageContainer>
  );
};

DashboardPage.path = "/";
