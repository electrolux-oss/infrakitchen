import { useState } from "react";

import { Icon } from "@iconify/react";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { Button, Stack } from "@mui/material";

import { useConfig } from "../../common";
import { notifyError } from "../../common/hooks/useNotification";

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
      .deleteRaw(`users/${primary_account}/link/${secondary_account}`, {})
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
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            color="success"
            size="small"
            startIcon={<CheckIcon />}
            onClick={() => handleUnlinkAccount()}
            sx={{ textTransform: "none", fontWeight: "bold" }}
            disabled={isLoading}
          >
            Approve
          </Button>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<CloseIcon />}
            onClick={handleCancelUnlink}
            sx={{ textTransform: "none", fontWeight: "bold" }}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </Stack>
      ) : (
        <Button
          variant="outlined"
          onClick={handleInitiateUnlinkConfirmation}
          startIcon={<Icon icon="carbon:unlink" />}
        >
          Unlink Account
        </Button>
      )}
    </>
  );
};
