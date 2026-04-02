import type { Metadata } from "next";
import { Cormorant_Garamond, Crimson_Pro } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ToasterProvider } from "@/components/toaster-provider";
import "./globals.css";

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-heading",
  subsets: ["latin", "vietnamese"],
  display: "swap",
  weight: ["400", "600", "700"],
});

const crimsonPro = Crimson_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  display: "swap",
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "InkRealm",
  description: "Your personal fantasy novel library",
};

/**
 * Root layout component that provides the application's HTML shell, global fonts, theme provider, and toast layer.
 *
 * @param children - The page content to render inside the layout
 * @returns The root HTML element containing <html> and <body> wrappers with font classes, theme provider, rendered children, and the toaster provider
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${cormorantGaramond.variable} ${crimsonPro.variable}`} suppressHydrationWarning>
      <body className="min-h-full font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
        >
          Skip to content
        </a>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <ToasterProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
