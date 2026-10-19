import React, { useCallback } from "react";

import { useNavigate } from "react-router";

import { useConfig } from "../../common";
import { Entity } from "../../common/components/entities/Entity";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { StatusLabel } from "../../common/components/labels";
import { FavoriteResource } from "../types";

export interface FavoriteResourceItemProps {
  resource: FavoriteResource;
}

export const FavoriteResourceItem = ({
  resource,
}: FavoriteResourceItemProps) => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const href =
    resource._component_type === "executor"
      ? `${linkPrefix}executors/${resource.id}`
      : `${linkPrefix}resources/${resource.id}`;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.button === 1) return;
      // The entity name renders as its own link (via the shared Entity
      // component) — let it handle navigation instead of double-navigating.
      if ((e.target as Element).closest("a")) return;
      e.preventDefault();
      navigate(href);
    },
    [navigate, href],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigate(href);
      }
    },
    [navigate, href],
  );

  return (
    <div
      className="flex cursor-pointer items-center gap-3 border-b border-divider px-4 py-2.5 [outline:none] [transition:background-color_120ms_ease-in-out] last:border-b-0 hover:bg-hover focus-visible:shadow-[0_0_0_2px]"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div
        className="min-w-0 flex-1 overflow-hidden whitespace-nowrap"
        title={resource.name}
      >
        <Entity
          entity={{
            id: resource.id,
            name: resource.name,
            entityType: resource.entityName ?? resource._component_type,
            template: resource.template,
          }}
          showLabel
        />
      </div>
      {resource.updatedAt && (
        <p className="m-0 text-body2 whitespace-nowrap text-fg-disabled">
          <RelativeTime className="flex" date={resource.updatedAt} compact />
        </p>
      )}
      {(resource.status || resource.state) && (
        <StatusLabel
          status={resource.status ?? ""}
          state={resource.state}
          compact
        />
      )}
    </div>
  );
};
