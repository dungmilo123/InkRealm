import type { Metadata } from "next";
import { Cinzel, Crimson_Pro } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700"],
});

const crimsonPro = Crimson_Pro({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "InkRealm",
  description: "Your personal fantasy novel library",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cinzel.variable} ${crimsonPro.variable}`}>
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
