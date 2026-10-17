import { useState } from "react";

import { Icon } from "@iconify/react";
import carbonLinkData from "@iconify-icons/carbon/link";

import { BaseCard } from "../../common/components/cards/BaseCard";
import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/fields/CommonField";
import { useEntityProvider } from "../../common/context/EntityContext";
import { Button } from "../../ui";
import { GqlUser, GqlUserShort } from "../graphql";

import { LinkUserDialog } from "./LinkAccountDialog";
import { UnlinkAccountButton } from "./UnlinkAccountDialog";

export interface TemplateConfigurationProps {
  user: GqlUser;
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
    <BaseCard name="User Configuration">
      {user.primaryAccount?.length === 0 && (
        <CommonField
          name="Secondary Accounts"
          value={
            <>
              <div>
                {user.secondaryAccounts?.map((ent: GqlUserShort) => (
                  <CommonField
                    name={ent.identifier}
                    value={<GetReferenceUrlValue {...ent} />}
                    key={ent.id}
                  />
                ))}
              </div>
              {user.secondaryAccounts?.length === 0 && (
                <div className="text-fg-muted">No secondary accounts</div>
              )}
              <Button
                className="mt-4"
                onClick={() => handleOpenSecondaryAccountsDialog()}
                startIcon={<Icon icon={carbonLinkData} ssr />}
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
      {user.isPrimary !== true && (
        <CommonField
          name="Primary Account"
          value={
            <>
              <div>
                {user.primaryAccount?.map((ent: GqlUserShort) => (
                  <CommonField
                    name={ent.identifier}
                    value={<GetReferenceUrlValue {...ent} />}
                    key={ent.id}
                  />
                ))}
              </div>
              {user.primaryAccount?.length === 0 && (
                <div className="text-fg-muted">No primary account</div>
              )}
              {user.primaryAccount?.length === 1 && (
                <UnlinkAccountButton
                  primary_account={user.primaryAccount?.[0]?.id}
                  secondary_account={user.id}
                  onUnlink={() => refreshEntity?.()}
                />
              )}
            </>
          }
        />
      )}
    </BaseCard>
  );
};
