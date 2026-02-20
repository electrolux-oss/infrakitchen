import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useConfig } from "./ConfigContext";

export type FavoriteComponentType = "resource" | "executor";

interface FavoriteResponse {
  component_type: FavoriteComponentType;
  component_id: string;
}

interface FavoritesContextType {
  isFavorite: (
    componentType: FavoriteComponentType,
    componentId: string,
  ) => boolean;
  toggleFavorite: (
    componentType: FavoriteComponentType,
    componentId: string,
  ) => Promise<void>;
  isSubmitting: (
    componentType: FavoriteComponentType,
    componentId: string,
  ) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(
  undefined,
);

const toFavoriteKey = (
  componentType: FavoriteComponentType,
  componentId: string,
) => `${componentType}:${String(componentId)}`;

export const FavoritesProvider = ({ children }: { children: ReactNode }) => {
  const { ikApi } = useConfig();
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());
  const [submittingKeys, setSubmittingKeys] = useState<Set<string>>(new Set());

  const fetchFavorites = useCallback(async () => {
    try {
      const favorites = await ikApi.get("favorites");
      const keys = new Set<string>();
      (favorites as FavoriteResponse[]).forEach((favorite) => {
        keys.add(
          toFavoriteKey(favorite.component_type, String(favorite.component_id)),
        );
      });
      setFavoriteKeys(keys);
    } catch {
      setFavoriteKeys(new Set());
    }
  }, [ikApi]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const isFavorite = useCallback(
    (componentType: FavoriteComponentType, componentId: string) =>
      favoriteKeys.has(toFavoriteKey(componentType, componentId)),
    [favoriteKeys],
  );

  const isSubmitting = useCallback(
    (componentType: FavoriteComponentType, componentId: string) =>
      submittingKeys.has(toFavoriteKey(componentType, componentId)),
    [submittingKeys],
  );

  const toggleFavorite = useCallback(
    async (componentType: FavoriteComponentType, componentId: string) => {
      const key = toFavoriteKey(componentType, componentId);
      if (submittingKeys.has(key)) {
        return;
      }

      setSubmittingKeys((prev) => new Set(prev).add(key));
      try {
        if (favoriteKeys.has(key)) {
          await ikApi.deleteRaw(
            `favorites/${componentType}/${componentId}`,
            {},
          );
          setFavoriteKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
          return;
        }

        await ikApi.postRaw("favorites", {
          component_type: componentType,
          component_id: componentId,
        });
        setFavoriteKeys((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      } finally {
        setSubmittingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [favoriteKeys, ikApi, submittingKeys],
  );

  const value = useMemo<FavoritesContextType>(
    () => ({
      isFavorite,
      toggleFavorite,
      isSubmitting,
    }),
    [isFavorite, toggleFavorite, isSubmitting],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
};
