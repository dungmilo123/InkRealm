import Link from "next/link";
import { UserMenu } from "./user-menu";

interface LibraryShelfProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  backHref?: string;
  activeRoute?: "dashboard" | "settings";
  user?: { name?: string | null; image?: string | null } | null;
  signOutAction?: () => Promise<void>;
}

/**
 * Render a page shell with a header and a centered main area for the library UI.
 *
 * The header shows either a back link (when `showBack` is true) or the primary branding.
 * When `activeRoute` is provided and `showBack` is false, a small-screen-hidden main navigation
 * ("Library" and "Settings") is rendered and the matching route receives active styling and
 * `aria-current="page"`. If both `user` and `signOutAction` are provided, a `UserMenu` is shown;
 * otherwise a "My Library" link is displayed.
 *
 * @param children - Main content to render inside the page shell
 * @param showBack - When true, show a back link instead of the primary branding/navigation
 * @param backHref - Destination URL for the back link (defaults to "/dashboard")
 * @param activeRoute - If provided, highlights the corresponding primary navigation item
 * @param user - Authenticated user object; required alongside `signOutAction` to enable `UserMenu`
 * @param signOutAction - Action to sign the user out; required alongside `user` to enable `UserMenu`
 * @returns A React element representing the library page layout
 */
export function LibraryShelf({ children, showBack, backHref = "/dashboard", activeRoute, user, signOutAction }: LibraryShelfProps) {
  return (
    <div className="flex flex-col flex-1 bg-background">
      <header className="w-full border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {showBack ? (
                <Link
                  href={backHref}
                  className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg
                    className="mr-1.5 size-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  <span className="font-heading font-bold">InkRealm</span>
                </Link>
              ) : (
                <>
                  <Link
                    href="/dashboard"
                    className="text-2xl font-heading font-bold tracking-tight text-card-foreground"
                  >
                    InkRealm
                  </Link>
                  {activeRoute && (
                    <nav className="hidden sm:flex items-center gap-4" aria-label="Main navigation">
                      <Link
                        href="/dashboard"
                        className={`text-sm font-medium transition-colors ${
                          activeRoute === "dashboard"
                            ? "text-foreground border-b-2 border-primary pb-0.5"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        aria-current={activeRoute === "dashboard" ? "page" : undefined}
                      >
                        Library
                      </Link>
                      <Link
                        href="/settings"
                        className={`text-sm font-medium transition-colors ${
                          activeRoute === "settings"
                            ? "text-foreground border-b-2 border-primary pb-0.5"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        aria-current={activeRoute === "settings" ? "page" : undefined}
                      >
                        Settings
                      </Link>
                    </nav>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              {user && signOutAction ? (
                <UserMenu user={user} signOutAction={signOutAction} />
              ) : (
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  My Library
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>
      <main id="main" className="flex-1 w-full max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
