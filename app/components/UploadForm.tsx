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
        const errorText = data.error || "Upload failed";
        setMessage({ type: "error", text: errorText });
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <label className="flex-1 flex items-center h-11 cursor-pointer rounded-lg border border-dashed border-border bg-secondary/50 px-4 text-sm text-foreground hover:bg-accent/50 transition-colors">
            <span className="mr-3 text-muted-foreground">Choose file</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.epub"
              required
              className="flex-1 text-sm file:hidden"
            />
          </label>
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {uploading && (
              <svg
                className="size-4 motion-safe:animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {uploading ? "Uploading..." : "Upload Novel"}
          </button>
        </div>
        <div aria-live="polite" role="status">
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
        </div>
        <p className="text-xs text-muted-foreground">
          Supported formats: .txt, .epub
        </p>
    </form>
  );
}
