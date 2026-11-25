import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Avisos temporales (abajo a la derecha) siempre con fondo de color y texto blanco,
 * para que se distingan del fondo claro de la app: verde = éxito, rojo = error,
 * azul = información, ámbar = advertencia, verde oscuro = aviso general.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "gf-toast",
          success: "gf-toast-success",
          error: "gf-toast-error",
          info: "gf-toast-info",
          warning: "gf-toast-warning",
          title: "gf-toast-title",
          description: "gf-toast-description",
          closeButton: "gf-toast-close",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
