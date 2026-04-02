/**
 * Loading skeleton for the register page.
 * Mirrors the RegisterForm layout: heading, subtitle, email input,
 * password input, confirm-password input, submit button, and "Sign in" link.
 */
export default function RegisterLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-6">
        {/* Heading + subtitle */}
        <div className="flex flex-col items-center gap-2">
          <div className="h-9 w-44 rounded bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded bg-muted animate-pulse" />
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          {/* Email field */}
          <div className="space-y-2">
            <div className="h-4 w-10 rounded bg-muted animate-pulse" />
            <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
          </div>
          {/* Password field */}
          <div className="space-y-2">
            <div className="h-4 w-16 rounded bg-muted animate-pulse" />
            <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
          </div>
          {/* Confirm password field */}
          <div className="space-y-2">
            <div className="h-4 w-28 rounded bg-muted animate-pulse" />
            <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
          </div>
          {/* Submit button */}
          <div className="h-11 w-full rounded-md bg-muted animate-pulse" />
        </div>

        {/* "Sign in" link */}
        <div className="flex justify-center">
          <div className="h-4 w-44 rounded bg-muted animate-pulse" />
        </div>
      </div>
    </main>
  );
}
