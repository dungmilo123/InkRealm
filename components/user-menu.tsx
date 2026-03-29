"use client";

import { useTransition } from "react";

export function UserMenu({
  user,
  signOutAction,
}: {
  user: { name?: string | null; image?: string | null };
  signOutAction: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      {user.image && (
        <img
          src={user.image}
          alt={user.name ?? "User avatar"}
          className="size-8 rounded-full"
          referrerPolicy="no-referrer"
        />
      )}
      {user.name && (
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {user.name}
        </span>
      )}
      <button
        onClick={() => startTransition(() => signOutAction())}
        disabled={isPending}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {isPending ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
