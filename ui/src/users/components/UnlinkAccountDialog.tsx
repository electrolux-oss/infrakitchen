import { useState } from "react";

import { Icon } from "@iconify/react";
import carbonUnlinkData from "@iconify-icons/carbon/unlink";

import { useConfig } from "../../common";
import { notifyError } from "../../common/hooks/useNotification";
import { CheckIcon, CloseIcon } from "../../icons/material";
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
            startIcon={<CheckIcon />}
            onClick={() => handleUnlinkAccount()}
            disabled={isLoading}
          >
            Approve
          </Button>
          <Button
            className="font-bold normal-case"
            color="error"
            startIcon={<CloseIcon />}
            onClick={handleCancelUnlink}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleInitiateUnlinkConfirmation}
          startIcon={<Icon icon={carbonUnlinkData} ssr />}
        >
          Unlink Account
        </Button>
      )}
    </>
  );
};
