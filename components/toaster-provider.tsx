"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/**
 * Provides a themed toast container connected to the current resolved theme.
 *
 * Renders a sonner Toaster positioned at the bottom-right, using the current theme ("light" or "dark", falling back to "dark" when unset) and applying the `font-sans` class to toasts.
 *
 * @returns The configured Toaster React element.
 */
export function ToasterProvider() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      theme={(resolvedTheme as "light" | "dark") ?? "dark"}
      position="bottom-right"
      toastOptions={{
        className: "font-sans",
      }}
    />
  );
}
