// app/register/page.tsx
import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your InkRealm account to start reading and translating novels",
};

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return <RegisterForm />;
}
