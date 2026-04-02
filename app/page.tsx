import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: {
    absolute: "InkRealm — Your Personal Novel Sanctuary",
  },
  description:
    "Upload, read, and translate novels with AI. InkRealm is your personal novel library with multi-provider translation support.",
};

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-background">
      <main className="flex flex-1 w-full flex-col items-center justify-center py-24 px-8">
        <div className="bg-card rounded-xl shadow-md p-8 w-full max-w-[480px] text-center space-y-6">
          <h1 className="text-4xl font-heading font-bold tracking-tight text-card-foreground">
            InkRealm
          </h1>
          <p className="text-base text-muted-foreground">
            Your personal novel sanctuary
          </p>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 w-full"
          >
            Open Your Collection
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </main>
      <footer className="w-full py-6 text-center">
        <p className="text-xs text-muted-foreground">
          Built for readers
        </p>
      </footer>
    </div>
  );
}
