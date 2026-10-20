import { useState } from "react";

import { useConfig } from "../../common";
import { notifyError } from "../../common/hooks/useNotification";
import { HeroCheckIcon, HeroLinkSlashIcon, HeroXMarkIcon } from "../../icons";
import { Button } from "../../ui";
import { UNLINK_USER_ACCOUNT_MUTATION } from "../graphql";

interface UnlinkAccountButtonProps {
  primary_account: string;
  secondary_account: string;
  onUnlink?: () => void;
}

export const UnlinkAccountButton = (props: UnlinkAccountButtonProps) => {
  const { primary_account, secondary_account, onUnlink } = props;
  const { ikApi } = useConfig();

  const [isConfirmingUnlink, setIsConfirmingUnlink] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleInitiateUnlinkConfirmation = () => {
    setIsConfirmingUnlink(true);
  };

  const handleCancelUnlink = () => {
    setIsConfirmingUnlink(false);
  };

  const handleUnlinkAccount = () => {
    if (!primary_account || !secondary_account) {
      notifyError(new Error("Accounts are required to unlink."));
      return;
    }

    setIsLoading(true);
    ikApi
      .graphqlRequest(UNLINK_USER_ACCOUNT_MUTATION, {
        primaryUserId: primary_account,
        secondaryUserId: secondary_account,
      })
      .then(() => {
        if (onUnlink) {
          onUnlink();
        }
      })
      .catch((error) => {
        notifyError(error);
        setIsLoading(false);
      });
  };

  return (
    <>
      {isConfirmingUnlink ? (
        <div className="flex flex-row gap-2">
          <Button
            className="font-bold normal-case"
            variant="contained"
            startIcon={<HeroCheckIcon />}
            onClick={() => handleUnlinkAccount()}
            disabled={isLoading}
          >
            Approve
          </Button>
          <Button
            className="font-bold normal-case"
            color="error"
            startIcon={<HeroXMarkIcon />}
            onClick={handleCancelUnlink}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleInitiateUnlinkConfirmation}
          startIcon={<HeroLinkSlashIcon />}
        >
          Unlink Account
        </Button>
      )}
    </>
  );
};
