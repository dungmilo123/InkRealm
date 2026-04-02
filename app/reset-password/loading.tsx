/**
 * Loading skeleton for the reset-password page.
 * Mirrors the ResetPasswordForm layout: heading, subtitle,
 * new-password input, confirm-password input, and submit button.
 */
export default function ResetPasswordLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background" aria-busy="true" aria-label="Loading password reset page">
      <div className="w-full max-w-sm space-y-8 px-6">
        {/* Heading + subtitle */}
        <div className="flex flex-col items-center gap-2">
          <div className="h-9 w-48 rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-4 w-52 rounded bg-muted motion-safe:animate-pulse" />
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          {/* New password field */}
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-10 w-full rounded-md bg-muted motion-safe:animate-pulse" />
          </div>
          {/* Confirm new password field */}
          <div className="space-y-2">
            <div className="h-4 w-36 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-10 w-full rounded-md bg-muted motion-safe:animate-pulse" />
          </div>
          {/* Submit button */}
          <div className="h-11 w-full rounded-md bg-muted motion-safe:animate-pulse" />
        </div>
      </div>
    </main>
  );
}
