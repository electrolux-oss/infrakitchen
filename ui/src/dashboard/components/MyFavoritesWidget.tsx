import { HeroHeartSolidIcon } from "../../icons";
import { Divider, Spinner } from "../../ui";
import { FavoriteResource } from "../types";

import { FavoriteResourceItem } from "./FavoriteResourceItem";

export interface MyFavoritesWidgetProps {
  favorites: FavoriteResource[];
  loading?: boolean;
}

export const MyFavoritesWidget = ({
  favorites,
  loading = false,
}: MyFavoritesWidgetProps) => {
  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-2">
        <HeroHeartSolidIcon className="text-[20px] text-primary" />
        <h6 className="m-0 text-subtitle1 font-semibold text-grey-500">
          My Favorites
        </h6>
        {!loading && (
          <span className="ml-auto text-caption text-fg-muted">
            {favorites.length}{" "}
            {favorites.length !== 1 ? "favorites" : "favorite"}
          </span>
        )}
      </div>
      <Divider className="mb-3" />
      <div className="max-h-100 overflow-hidden overflow-y-auto rounded-surface border border-divider bg-paper">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size={24} />
          </div>
        ) : favorites.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-fg-muted">
            <HeroHeartSolidIcon className="mb-2 text-[32px] text-primary opacity-50" />
            <p className="m-0 text-body2">No favorites yet.</p>
            <span className="text-caption">
              Pin resources for quick access.
            </span>
          </div>
        ) : (
          <div>
            {favorites.map((favorite) => (
              <FavoriteResourceItem key={favorite.id} resource={favorite} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
