import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your InkRealm account password",
};

type ForgotPasswordLayoutProps = {
  children: React.ReactNode;
};

export default function ForgotPasswordLayout({
  children,
}: ForgotPasswordLayoutProps) {
  return children;
}
