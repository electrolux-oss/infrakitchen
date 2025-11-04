import { useState, useCallback } from "react";

import { Controller, FormProvider, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";

import {
  Button,
  Box,
  TextField,
  Alert,
  Checkbox,
  FormControlLabel,
} from "@mui/material";

import { useConfig } from "../../common";
import { PropertyCard } from "../../common/components/PropertyCard";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { UserResponse, UserUpdate } from "../types";

export const UserEditPageInner = (props: { entity: UserResponse }) => {
  const { linkPrefix, ikApi } = useConfig();
  const { entity } = props;
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}users/${entity.id}`);

  const methods = useForm<UserUpdate>({
    mode: "onChange",
    defaultValues: {
      description: entity.description,
      password: entity.password,
      deactivated: entity.deactivated,
    },
  });

  const {
    control,
    handleSubmit,
    trigger,
    formState: { errors },
  } = methods;

  const onSubmit = useCallback(
    async (data: any) => {
      if (entity) {
        const isValid = await trigger();
        if (!isValid) {
          notifyError(new Error("Please fix the errors in the form"));
          return;
        }

        ikApi
          .patchRaw(`users/${entity.id}`, data)
          .then((response: UserResponse) => {
            if (response.id) {
              navigate(`${linkPrefix}users/${response.id}`);
              return response;
            }
          })
          .catch((error) => {
            notifyError(error);
          });
      }
    },
    [ikApi, entity, trigger, linkPrefix, navigate],
  );

  return (
    <FormProvider {...methods}>
      <PageContainer
        title="Edit User"
        onBack={handleBack}
        backAriaLabel="Back to user"
        bottomActions={
          <>
            <Button variant="outlined" color="primary" onClick={handleBack}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit(onSubmit)}
            >
              Update
            </Button>
          </>
        }
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexDirection: "column",
            width: "75%",
            minWidth: 320,
            maxWidth: 1000,
          }}
        >
          <PropertyCard title="User Definition">
            <Box>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Description"
                    variant="outlined"
                    error={!!errors.description}
                    helperText={
                      errors.description
                        ? errors.description.message
                        : "Provide a short description"
                    }
                    fullWidth
                    margin="normal"
                    slotProps={{
                      htmlInput: {
                        "aria-label": "User description",
                      },
                    }}
                  />
                )}
              />
              {entity.provider === "ik_service_account" && (
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Password"
                      variant="outlined"
                      error={!!errors.password}
                      type="password"
                      helperText={
                        errors.password
                          ? errors.password.message
                          : "Password for the user"
                      }
                      fullWidth
                      margin="normal"
                      slotProps={{
                        htmlInput: {
                          "aria-label": "User password",
                        },
                      }}
                    />
                  )}
                />
              )}
              <Controller
                name="deactivated"
                control={control}
                defaultValue={false}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Checkbox {...field} checked={field.value} />}
                    label="Deactivated"
                  />
                )}
              />
            </Box>
          </PropertyCard>
        </Box>
      </PageContainer>
    </FormProvider>
  );
};

export const UserEditPage = () => {
  const { user_id } = useParams();

  const [entity, setEntity] = useState<UserResponse>();
  const [error, setError] = useState<Error>();
  const { ikApi } = useConfig();

  const getUser = useCallback(async (): Promise<any> => {
    await ikApi
      .get(`users/${user_id}`)
      .then((response: UserResponse) => {
        setEntity(response);
        setError(undefined);
      })
      .catch((e: any) => setError(e));
  }, [ikApi, user_id]);

  useEffectOnce(() => {
    getUser();
  });

  return (
    <>
      {error && <Alert severity="error">{error.message}</Alert>}
      {entity && <UserEditPageInner entity={entity} />}
    </>
  );
};
UserEditPage.path = "/users/:user_id/edit";
