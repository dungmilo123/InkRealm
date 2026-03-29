import Link from "next/link";
import { UserMenu } from "./user-menu";

interface LibraryShelfProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  backHref?: string;
  user?: { name?: string | null; image?: string | null } | null;
  signOutAction?: () => Promise<void>;
}

export function LibraryShelf({ children, title, showBack, backHref = "/dashboard", user, signOutAction }: LibraryShelfProps) {
  return (
    <div className="flex flex-col flex-1 bg-background">
      <header className="w-full border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              {showBack && (
                <Link
                  href={backHref}
                  className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
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
                  Back to library
                </Link>
              )}
              {title && (
                <h1 className="text-2xl font-heading font-semibold tracking-tight text-card-foreground">
                  {title}
                </h1>
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
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
