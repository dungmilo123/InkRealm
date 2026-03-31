"use client";

import { useTransition } from "react";
import Link from "next/link";
import Image from "next/image";

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
        <Image
          src={user.image}
          alt={user.name ?? "User avatar"}
          width={32}
          height={32}
          className="size-8 rounded-full"
          referrerPolicy="no-referrer"
          unoptimized
        />
      )}
      {user.name && (
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {user.name}
        </span>
      )}
      <Link
        href="/settings"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Settings
      </Link>
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
