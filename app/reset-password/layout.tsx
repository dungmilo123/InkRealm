import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new password for your InkRealm account",
};

type ResetPasswordLayoutProps = {
  children: React.ReactNode;
};

export default function ResetPasswordLayout({
  children,
}: ResetPasswordLayoutProps) {
  return children;
}
