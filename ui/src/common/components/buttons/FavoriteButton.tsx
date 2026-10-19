import { useEffect, useState } from "react";

import {
  CREATE_FAVORITE_MUTATION,
  DELETE_FAVORITE_MUTATION,
} from "../../../favorites/graphql";
import { HeroHeartIcon, HeroHeartSolidIcon } from "../../../icons";
import { IconButton, Tooltip } from "../../../ui";
import { cn } from "../../../utils/cn";
import { useConfig } from "../../context/ConfigContext";
import { notifyError } from "../../hooks/useNotification";

export type FavoriteComponentType = "resource" | "executor";

interface FavoriteButtonProps {
  componentId: string;
  componentType: FavoriteComponentType;
  ariaLabel: string;
  format?: "overview" | "table";
  isFavorite?: boolean;
}

export const FavoriteButton = ({
  componentId,
  componentType,
  ariaLabel,
  format = "overview",
  isFavorite: isFavoriteProp,
}: FavoriteButtonProps) => {
  const { ikApi } = useConfig();
  const [favoriteState, setFavoriteState] = useState(Boolean(isFavoriteProp));
  const [submittingState, setSubmittingState] = useState(false);

  useEffect(() => {
    if (isFavoriteProp !== undefined) {
      setFavoriteState(isFavoriteProp);
    }
  }, [isFavoriteProp, componentId, componentType]);

  const handleAddFavorite = async () => {
    if (submittingState) {
      return;
    }

    setSubmittingState(true);
    try {
      if (favoriteState) {
        await ikApi.graphqlRequest(DELETE_FAVORITE_MUTATION, {
          input: {
            componentType: componentType,
            componentId: componentId,
          },
        });
        setFavoriteState(false);
      } else {
        await ikApi.graphqlRequest(CREATE_FAVORITE_MUTATION, {
          input: {
            componentType: componentType,
            componentId: componentId,
          },
        });
        setFavoriteState(true);
      }
    } catch (error: any) {
      notifyError(error);
    } finally {
      setSubmittingState(false);
    }
  };

  return (
    <Tooltip
      title={favoriteState ? "Remove from favorites" : "Add to favorites"}
    >
      <IconButton
        className={cn(
          "border-0 bg-transparent outline-none hover:bg-transparent",
          format === "table" && "size-5 min-w-0 p-0",
        )}
        size="small"
        aria-label={ariaLabel}
        onClick={handleAddFavorite}
        disabled={submittingState}
      >
        {favoriteState ? (
          <HeroHeartSolidIcon
            className="text-primary"
            fontSize={format === "table" ? "small" : "medium"}
          />
        ) : (
          <HeroHeartIcon fontSize={format === "table" ? "small" : "medium"} />
        )}
      </IconButton>
    </Tooltip>
  );
};
