"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { TranslationProvidersTab } from "./translation-providers-tab";

type SerializedTranslationProfile = {
  id: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  customPrompt: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

interface SettingsProps {
  user: {
    name: string | null;
    email: string;
    image: string | null;
    hasPassword: boolean;
    hasGoogle: boolean;
  };
  initialProfiles: SerializedTranslationProfile[];
}

export function SettingsClient({ user, initialProfiles }: SettingsProps) {
  return (
    <div className="flex min-h-screen justify-center bg-background">
      <div className="w-full max-w-2xl space-y-6 px-6 py-12">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Back to dashboard
          </Link>
          <h1 className="mt-4 text-3xl font-heading font-semibold tracking-tight text-foreground">
            Settings
          </h1>
        </div>

        <Tabs defaultValue="account">
          <TabsList variant="line">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="translation-providers">
              Translation Providers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-6 space-y-6">
            <ProfileSection user={user} />
            <PasswordSection hasPassword={user.hasPassword} />
            <LinkedAccountsSection
              hasGoogle={user.hasGoogle}
              hasPassword={user.hasPassword}
            />
          </TabsContent>

          <TabsContent value="translation-providers" className="mt-6">
            <TranslationProvidersTab initialProfiles={initialProfiles} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ProfileSection({ user }: { user: SettingsProps["user"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your account information</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          {user.image && (
            <Image
              src={user.image}
              alt={user.name ?? "Avatar"}
              width={64}
              height={64}
              className="size-16 rounded-full"
              referrerPolicy="no-referrer"
              unoptimized
            />
          )}
          <div>
            {user.name && (
              <p className="font-medium text-foreground">{user.name}</p>
            )}
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setSuccess("Password set successfully");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setSuccess("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{hasPassword ? "Change password" : "Set password"}</CardTitle>
        <CardDescription>
          {hasPassword
            ? "Update your current password"
            : "Set a password to sign in with email"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={hasPassword ? handleChangePassword : handleSetPassword}
          className="space-y-4"
        >
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground">
              {success}
            </div>
          )}

          {hasPassword && (
            <div className="space-y-2">
              <label
                htmlFor="currentPassword"
                className="text-sm font-medium text-foreground"
              >
                Current password
              </label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="newPassword"
              className="text-sm font-medium text-foreground"
            >
              New password
            </label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirmNewPassword"
              className="text-sm font-medium text-foreground"
            >
              Confirm new password
            </label>
            <Input
              id="confirmNewPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" disabled={loading} size="lg">
            {loading
              ? "Saving..."
              : hasPassword
                ? "Change password"
                : "Set password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function LinkedAccountsSection({
  hasGoogle,
  hasPassword,
}: {
  hasGoogle: boolean;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUnlinkGoogle() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/unlink-google", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        router.refresh();
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkGoogle() {
    await signIn("google", { callbackUrl: "/settings" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linked accounts</CardTitle>
        <CardDescription>
          Manage your connected sign-in methods
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="size-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-foreground">Google</p>
              <p className="text-xs text-muted-foreground">
                {hasGoogle ? "Connected" : "Not connected"}
              </p>
            </div>
          </div>

          {hasGoogle ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnlinkGoogle}
              disabled={loading || !hasPassword}
              title={
                !hasPassword
                  ? "Set a password before unlinking Google"
                  : undefined
              }
            >
              {loading ? "Unlinking..." : "Unlink"}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleLinkGoogle}>
              Link
            </Button>
          )}
        </div>

        {hasGoogle && !hasPassword && (
          <p className="mt-2 text-xs text-muted-foreground">
            Set a password before unlinking Google to keep access to your
            account.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
