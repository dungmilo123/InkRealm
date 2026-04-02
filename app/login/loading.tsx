/**
 * Loading skeleton for the login page.
 * Mirrors the LoginForm layout: heading, subtitle, email input, password input
 * with "Forgot password?" link, submit button, "or" divider, Google button,
 * and "Create account" link.
 */
export default function LoginLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-6">
        {/* Heading + subtitle */}
        <div className="flex flex-col items-center gap-2">
          <div className="h-9 w-36 rounded bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded bg-muted animate-pulse" />
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          {/* Email field */}
          <div className="space-y-2">
            <div className="h-4 w-10 rounded bg-muted animate-pulse" />
            <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
          </div>
          {/* Password field with "Forgot password?" link */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-16 rounded bg-muted animate-pulse" />
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
          </div>
          {/* Submit button */}
          <div className="h-11 w-full rounded-md bg-muted animate-pulse" />
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Google sign-in button */}
        <div className="h-12 w-full rounded-lg bg-muted animate-pulse" />

        {/* "Create account" link */}
        <div className="flex justify-center">
          <div className="h-4 w-48 rounded bg-muted animate-pulse" />
        </div>
      </div>
    </main>
  );
}
