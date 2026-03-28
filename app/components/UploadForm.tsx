"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export function UploadForm() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setMessage({ type: "error", text: "Please select a file" });
      return;
    }

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Upload failed" });
      } else {
        setMessage({ type: "success", text: "Novel uploaded successfully!" });
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        router.refresh();
      }
    } catch {
      setMessage({ type: "error", text: "Upload failed. Please try again." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-5 rounded-lg border border-border bg-card">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.epub"
            required
            className="flex-1 text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-border file:text-sm file:font-medium file:bg-secondary file:text-secondary-foreground hover:file:bg-accent transition-colors cursor-pointer"
          />
          <button
            type="submit"
            disabled={uploading}
            className="h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {uploading ? "Uploading..." : "Upload Novel"}
          </button>
        </div>
        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Supported formats: .txt, .epub
        </p>
      </form>
    </div>
  );
}
