"use client";

import { useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  user,
  signOutAction,
}: {
  user: { name?: string | null; image?: string | null };
  signOutAction: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        aria-label={user.name ? `${user.name}'s account menu` : "Account menu"}
      >
        {user.image ? (
          <Image
            src={user.image}
            alt=""
            width={28}
            height={28}
            className="size-7 rounded-full"
            referrerPolicy="no-referrer"
            unoptimized
          />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {user.name?.charAt(0)?.toUpperCase() ?? "U"}
          </span>
        )}
        {user.name && (
          <span className="hidden sm:inline">{user.name}</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          render={<Link href="/settings" />}
          className="cursor-pointer"
        >
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isPending}
          onClick={() => startTransition(() => signOutAction())}
          variant="destructive"
          className="cursor-pointer"
        >
          {isPending ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
