import { ReactNode, useState } from "react";

import {
  FormProvider,
  useForm,
  FieldValues,
  UseFormReturn,
  DefaultValues,
  SubmitHandler,
} from "react-hook-form";

import CloseIcon from "@mui/icons-material/Close";
import {
  Button,
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogContent,
} from "@mui/material";

interface EntityCreateFormProps<T extends FieldValues> {
  onClose?: () => void;
  onSubmit: SubmitHandler<T>;
  saving: boolean;
  title: string;
  defaultValues: DefaultValues<T>;
  children: (methods: UseFormReturn<T>) => ReactNode;
}

export const EntityCreateForm = <T extends FieldValues>({
  onClose,
  onSubmit,
  saving,
  title,
  defaultValues,
  children,
}: EntityCreateFormProps<T>) => {
  const methods = useForm<T>({
    mode: "onChange",
    defaultValues,
  });

  const { handleSubmit } = methods;
  const [showError, setShowError] = useState(false);

  const onInvalid = () => {
    setShowError(true);
  };

  const validSubmit: SubmitHandler<T> = (data) => {
    setShowError(false);
    onSubmit(data);
  };

  return (
    <Box
      sx={{
        p: 2,
        width: "900px",
        height: "750px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pb: 2,
        }}
      >
        <Box>
          <Typography variant="h4" component="h2" gutterBottom sx={{ mb: 0 }}>
            {title}
          </Typography>
          {showError && (
            <Typography color="error" variant="body2">
              Please fill all required fields
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} disabled={saving}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Box
        sx={{
          overflowY: "auto",
          flexGrow: 1,
          pr: 2,
          mr: -2,
          // hide scrollbar
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(validSubmit, onInvalid)}>
            {children(methods)}
          </form>
        </FormProvider>
      </Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          mt: 2,
          pt: 2,
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <Button
          type="submit"
          variant="contained"
          disabled={saving}
          onClick={handleSubmit(validSubmit, onInvalid)}
        >
          Submit
        </Button>
      </Box>
    </Box>
  );
};

interface EntityCreateDialogProps<T extends FieldValues>
  extends Omit<EntityCreateFormProps<T>, "children"> {
  open: boolean;
  children: (methods: UseFormReturn<T>) => ReactNode;
}

export const EntityCreateDialog = <T extends FieldValues>({
  open,
  onClose,
  ...rest
}: EntityCreateDialogProps<T>) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        style: {
          borderRadius: "0.5em",
        },
      }}
    >
      <DialogContent>
        <EntityCreateForm onClose={onClose} {...rest} />
      </DialogContent>
    </Dialog>
  );
};
