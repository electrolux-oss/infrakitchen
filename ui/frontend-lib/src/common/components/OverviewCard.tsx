import { useContext } from "react";

import { EntityContext } from "../context/EntityContext";

import { BaseCard, BaseCardProps } from "./BaseCard";
import { EntityRefreshButton } from "./buttons/EntityRefreshButton";

/**
 * BaseCard variant used as the lead card on entity overview pages. Rendering is
 * delegated to BaseCard so every overview shares the exact same header + grid
 * layout; this wrapper only adds the entity-page behavior on top: when the card
 * is rendered inside an entity detail page (i.e. an EntityProvider is present),
 * a refresh button is appended to the header actions so the page can re-fetch
 * the entity it displays.
 *
 * Outside an entity page the refresh affordance is omitted, making OverviewCard
 * behave as a plain BaseCard. Takes the same props as BaseCard.
 */
export const OverviewCard = (props: BaseCardProps) => {
  const { actions, ...baseProps } = props;

  // Show the refresh button only on entity detail pages: the EntityProvider
  // mounts its context there (useContext returns undefined elsewhere), and
  // EntityRefreshButton reads it via useEntityProvider, which throws if the
  // context is missing.
  const showRefresh = !!useContext(EntityContext);

  // Build the header actions in one expression so CardHeader's action slot
  // stays empty (undefined) when there is nothing to show.
  const headerActions =
    actions || showRefresh ? (
      <>
        {actions}
        {showRefresh && <EntityRefreshButton />}
      </>
    ) : undefined;

  return <BaseCard {...baseProps} actions={headerActions} />;
};
