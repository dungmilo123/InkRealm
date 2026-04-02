// app/register/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { RegisterForm } from "./register-form";

/**
 * Render the registration page or redirect authenticated users to the dashboard.
 *
 * @returns The `RegisterForm` React element when no authenticated session exists; otherwise performs a redirect to `/dashboard`.
 */
export default async function RegisterPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return <RegisterForm />;
}
