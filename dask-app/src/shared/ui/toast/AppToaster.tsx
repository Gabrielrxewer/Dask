import { Toaster, type ToasterProps } from "sonner";

export type AppToasterProps = ToasterProps;

export function AppToaster({
  position = "top-right",
  richColors = true,
  closeButton = true,
  expand = false,
  ...props
}: AppToasterProps) {
  return (
    <Toaster
      position={position}
      richColors={richColors}
      closeButton={closeButton}
      expand={expand}
      toastOptions={{
        classNames: {
          toast: "app-toast",
          title: "app-toast__title",
          description: "app-toast__description",
          actionButton: "app-toast__action",
          cancelButton: "app-toast__cancel",
          closeButton: "app-toast__close"
        },
        ...props.toastOptions
      }}
      {...props}
    />
  );
}

