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
    <div className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.epub"
            required
            className="flex-1 text-sm text-zinc-700 dark:text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-zinc-100 dark:file:bg-zinc-800 file:text-zinc-700 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700"
          />
          <button
            type="submit"
            disabled={uploading}
            className="h-10 px-6 rounded-full bg-black dark:bg-zinc-50 text-white dark:text-black text-sm font-medium disabled:opacity-50 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Supported formats: .txt, .epub. Maximum size: 50MB.
        </p>
      </form>
    </div>
  );
}