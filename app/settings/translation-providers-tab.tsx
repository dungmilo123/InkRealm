"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Settings2 } from "lucide-react";

const PROFILE_PROVIDER_OPTIONS = [
  "OPENAI",
  "ANTHROPIC",
  "DEEPSEEK",
  "OPENROUTER",
  "MINIMAX",
] as const;

type SerializedTranslationProfile = {
  id: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type TranslationProvidersTabProps = {
  initialProfiles: SerializedTranslationProfile[];
};

async function readJsonOrError<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }
  return payload;
}

export function TranslationProvidersTab({
  initialProfiles,
}: TranslationProvidersTabProps) {
  const [profiles, setProfiles] =
    useState<SerializedTranslationProfile[]>(initialProfiles);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [busy, setBusy] = useState(false);

  // Edit form state
  const [editModel, setEditModel] = useState("");
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editApiKey, setEditApiKey] = useState("");

  // Create form state
  const [createProvider, setCreateProvider] = useState<
    (typeof PROFILE_PROVIDER_OPTIONS)[number]
  >("OPENAI");
  const [createModel, setCreateModel] = useState("");
  const [createBaseUrl, setCreateBaseUrl] = useState("");
  const [createApiKey, setCreateApiKey] = useState("");

  function setFeedbackWithDismiss(fb: { type: "success" | "error"; text: string }) {
    setFeedback(fb);
    setTimeout(() => setFeedback(null), 5000);
  }

  async function refreshProfiles() {
    const response = await fetch("/api/translation/profiles");
    const data = await readJsonOrError<{
      profiles: SerializedTranslationProfile[];
    }>(response);
    setProfiles(data.profiles);
  }

  function startEditing(profile: SerializedTranslationProfile) {
    setEditingId(profile.id);
    setEditModel(profile.model);
    setEditBaseUrl(profile.baseUrl ?? "");
    setEditApiKey("");
  }

  function discardEdit() {
    setEditingId(null);
    setEditModel("");
    setEditBaseUrl("");
    setEditApiKey("");
  }

  function resetCreateForm() {
    setCreateProvider("OPENAI");
    setCreateModel("");
    setCreateBaseUrl("");
    setCreateApiKey("");
  }

  async function handleSetDefault(profileId: string) {
    setBusy(true);
    setFeedback(null);
    try {
      await fetch(`/api/translation/profiles/${profileId}/default`, {
        method: "PUT",
      });
      await refreshProfiles();
      setFeedbackWithDismiss({
        type: "success",
        text: "Default provider updated.",
      });
    } catch (error) {
      setFeedbackWithDismiss({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to update default provider.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(profileId: string) {
    setBusy(true);
    setFeedback(null);
    try {
      await fetch(`/api/translation/profiles/${profileId}`, {
        method: "DELETE",
      });
      await refreshProfiles();
      setEditingId(null);
      setFeedbackWithDismiss({ type: "success", text: "Provider deleted." });
    } catch (error) {
      setFeedbackWithDismiss({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to delete provider. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(profileId: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const body: Record<string, string | null> = { model: editModel };
      body.baseUrl = editBaseUrl || null;
      if (editApiKey) body.apiKey = editApiKey;
      const response = await fetch(
        `/api/translation/profiles/${profileId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      await readJsonOrError(response);
      await refreshProfiles();
      setEditingId(null);
      setFeedbackWithDismiss({
        type: "success",
        text: "Provider updated successfully.",
      });
    } catch (error) {
      setFeedbackWithDismiss({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to save provider. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateProfile(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/translation/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: createProvider,
          model: createModel,
          baseUrl: createBaseUrl || null,
          apiKey: createApiKey,
        }),
      });
      await readJsonOrError(response);
      await refreshProfiles();
      setShowCreateForm(false);
      resetCreateForm();
      setFeedbackWithDismiss({
        type: "success",
        text: "Provider saved successfully.",
      });
    } catch (error) {
      setFeedbackWithDismiss({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to save provider. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  // Empty state
  if (profiles.length === 0 && !showCreateForm) {
    return (
      <div className="space-y-4">
        {feedback && (
          <FeedbackBanner type={feedback.type} text={feedback.text} />
        )}
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Settings2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-foreground font-bold">
            No translation providers
          </p>
          <p className="text-sm text-muted-foreground">
            Add a provider to start translating your novels.
          </p>
          <Button
            variant="outline"
            className="border-dashed"
            onClick={() => setShowCreateForm(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Provider
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <FeedbackBanner type={feedback.type} text={feedback.text} />
      )}

      {/* Profile cards */}
      <div className="space-y-4">
        {profiles.map((profile) =>
          editingId === profile.id ? (
            <Card key={profile.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="text-foreground">{profile.provider}</span>
                  {profile.isDefault && <Badge variant="default">Default</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`edit-provider-${profile.id}`}>
                      Provider
                    </Label>
                    <Select value={profile.provider} disabled>
                      <SelectTrigger
                        id={`edit-provider-${profile.id}`}
                        className="w-full"
                        disabled
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROFILE_PROVIDER_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`edit-model-${profile.id}`}>Model</Label>
                    <Input
                      id={`edit-model-${profile.id}`}
                      value={editModel}
                      onChange={(e) => setEditModel(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`edit-baseurl-${profile.id}`}>
                      Base URL
                    </Label>
                    <Input
                      id={`edit-baseurl-${profile.id}`}
                      value={editBaseUrl}
                      onChange={(e) => setEditBaseUrl(e.target.value)}
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`edit-apikey-${profile.id}`}>
                      API Key
                    </Label>
                    <Input
                      id={`edit-apikey-${profile.id}`}
                      type="password"
                      value={editApiKey}
                      onChange={(e) => setEditApiKey(e.target.value)}
                      placeholder="Enter new API key (leave blank to keep current)"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={discardEdit}
                      disabled={busy}
                    >
                      Discard Changes
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleSaveEdit(profile.id)}
                      disabled={busy}
                      aria-busy={busy}
                    >
                      {busy ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card key={profile.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="text-foreground">{profile.provider}</span>
                  {profile.isDefault && <Badge variant="default">Default</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {profile.model}
                </p>
                <p
                  className="text-sm text-muted-foreground font-mono"
                  aria-label="Encrypted API key"
                >
                  ••••••••••••
                </p>
                {profile.baseUrl && (
                  <p className="text-sm text-muted-foreground">
                    {profile.baseUrl}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditing(profile)}
                    disabled={busy}
                  >
                    Edit
                  </Button>
                  {!profile.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(profile.id)}
                      disabled={busy}
                      aria-busy={busy}
                    >
                      {busy ? "Saving..." : "Set as Default"}
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={busy}
                        />
                      }
                    >
                      Delete
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete translation provider
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          <>
                            Are you sure you want to delete{" "}
                            <strong>
                              {profile.provider} · {profile.model}
                            </strong>
                            ? This action cannot be undone.
                            {profile.isDefault &&
                              " The next most recently updated profile will become the default."}
                          </>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Provider</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleDelete(profile.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* Add Provider button */}
      <Button
        variant="outline"
        className="w-full border-dashed"
        onClick={() => setShowCreateForm(true)}
        disabled={showCreateForm || busy}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Provider
      </Button>

      {/* Create form */}
      {showCreateForm && (
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <form onSubmit={handleCreateProfile} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="create-provider">Provider</Label>
                  <Select
                    value={createProvider}
                    onValueChange={(val) =>
                      setCreateProvider(
                        val as (typeof PROFILE_PROVIDER_OPTIONS)[number]
                      )
                    }
                  >
                    <SelectTrigger
                      id="create-provider"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROFILE_PROVIDER_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-model">Model</Label>
                  <Input
                    id="create-model"
                    value={createModel}
                    onChange={(e) => setCreateModel(e.target.value)}
                    placeholder="gpt-4o-mini"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-baseurl">Base URL (optional)</Label>
                <Input
                  id="create-baseurl"
                  value={createBaseUrl}
                  onChange={(e) => setCreateBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-apikey">API Key</Label>
                <Input
                  id="create-apikey"
                  type="password"
                  value={createApiKey}
                  onChange={(e) => setCreateApiKey(e.target.value)}
                  placeholder="Paste API key"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetCreateForm();
                  }}
                  disabled={busy}
                >
                  Discard
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={busy}
                  aria-busy={busy}
                >
                  {busy ? "Saving..." : "Save Provider"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FeedbackBanner({
  type,
  text,
}: {
  type: "success" | "error";
  text: string;
}) {
  if (type === "error") {
    return (
      <div
        role="alert"
        className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {text}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground">
      {text}
    </div>
  );
}
