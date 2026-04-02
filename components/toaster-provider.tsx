"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

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
