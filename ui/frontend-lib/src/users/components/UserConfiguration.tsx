import { useState } from "react";

import { Icon } from "@iconify/react";
import { Box, Button } from "@mui/material";

import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import { useEntityProvider } from "../../common/context/EntityContext";
import { UserResponse, UserShort } from "../types";

import { LinkUserDialog } from "./LinkAccountDialog";
import { UnlinkAccountButton } from "./UnlinkAccountDialog";

export interface TemplateConfigurationProps {
  user: UserResponse;
}

export const UserConfiguration = ({ user }: TemplateConfigurationProps) => {
  const { refreshEntity } = useEntityProvider();
  const [isSecondaryAccountsDialogOpen, setIsSecondaryAccountsDialogOpen] =
    useState(false);

  const handleOpenSecondaryAccountsDialog = () => {
    setIsSecondaryAccountsDialogOpen(true);
  };
  const handleCloseSecondaryAccountsDialog = () => {
    setIsSecondaryAccountsDialogOpen(false);
    refreshEntity?.();
  };

  return (
    <PropertyCollapseCard
      title={"User Configuration"}
      expanded={true}
      id="user-configuration"
    >
      <OverviewCard>
        {user.primary_account?.length === 0 && (
          <CommonField
            name="Secondary Accounts"
            value={
              <>
                <Box>
                  {user.secondary_accounts?.map((ent: UserShort) => (
                    <CommonField
                      name={ent.identifier}
                      value={<GetReferenceUrlValue {...ent} />}
                      key={ent.id}
                    />
                  ))}
                </Box>
                {user.secondary_accounts?.length === 0 && (
                  <Box sx={{ color: "text.secondary" }}>
                    No secondary accounts
                  </Box>
                )}
                <Button
                  variant="outlined"
                  onClick={() => handleOpenSecondaryAccountsDialog()}
                  startIcon={<Icon icon="carbon:link" />}
                  sx={{ mt: 2 }}
                >
                  Link Secondary Account
                </Button>
                <LinkUserDialog
                  primary_account={user.id}
                  open={isSecondaryAccountsDialogOpen}
                  onClose={handleCloseSecondaryAccountsDialog}
                />
              </>
            }
          />
        )}
        {user.is_primary !== true && (
          <CommonField
            name="Primary Account"
            value={
              <>
                <Box>
                  {user.primary_account?.map((ent: UserShort) => (
                    <CommonField
                      name={ent.identifier}
                      value={<GetReferenceUrlValue {...ent} />}
                      key={ent.id}
                    />
                  ))}
                </Box>
                {user.primary_account?.length === 0 && (
                  <Box sx={{ color: "text.secondary" }}>No primary account</Box>
                )}
                {user.primary_account?.length === 1 && (
                  <UnlinkAccountButton
                    primary_account={user.primary_account?.[0]?.id}
                    secondary_account={user.id}
                    onUnlink={() => refreshEntity?.()}
                  />
                )}
              </>
            }
          />
        )}
      </OverviewCard>
    </PropertyCollapseCard>
  );
};
