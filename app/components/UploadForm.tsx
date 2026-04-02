"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, BookOpen, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { validateUploadClient } from "@/lib/upload-validation";
import { formatFileSize } from "@/app/lib/format";

type SelectedFile = {
  file: File;
  error?: string;
};

export function UploadForm() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFile = useCallback((file: File) => {
    setMessage(null);
    const validation = validateUploadClient(file);
    if (!validation.valid) {
      setSelectedFile({ file, error: validation.error });
    } else {
      setSelectedFile({ file });
    }
  }, []);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // --- Drag and drop handlers ---

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only leave if we're actually leaving the drop zone (not entering a child)
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      if (files.length > 1) {
        setMessage({ type: "error", text: "Please drop only one file at a time" });
        return;
      }

      handleFile(files[0]);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  // --- Upload ---

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedFile || selectedFile.error) return;

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", selectedFile.file);

    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Upload failed" });
      } else {
        setMessage({ type: "success", text: `"${selectedFile.file.name}" uploaded successfully!` });
        clearFile();
        router.refresh();
      }
    } catch {
      setMessage({ type: "error", text: "Upload failed. Please try again." });
    } finally {
      setUploading(false);
    }
  }

  const fileIcon =
    selectedFile?.file.name.endsWith(".epub") ? (
      <BookOpen className="size-5 text-primary" />
    ) : (
      <FileText className="size-5 text-primary" />
    );

  const canSubmit = selectedFile && !selectedFile.error && !uploading;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Drop zone / file selector */}
      {!selectedFile ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-secondary/30 hover:border-muted-foreground/40 hover:bg-secondary/50"
          }`}
        >
          <div
            className={`rounded-full p-3 transition-colors ${
              isDragOver ? "bg-primary/10" : "bg-muted"
            }`}
          >
            <Upload
              className={`size-5 transition-colors ${
                isDragOver ? "text-primary" : "text-muted-foreground"
              }`}
            />
          </div>
          <div className="text-center">
            <p className="text-sm text-foreground font-medium">
              {isDragOver ? "Drop your novel here" : "Drag & drop your novel here"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or <span className="text-primary">browse files</span> · .txt, .epub up to 50 MB
            </p>
          </div>
        </div>
      ) : (
        /* File preview card */
        <div
          className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
            selectedFile.error
              ? "border-destructive/40 bg-destructive/5"
              : "border-border bg-secondary/30"
          }`}
        >
          <div className="shrink-0">{fileIcon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {selectedFile.file.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedFile.file.name.split(".").pop()?.toUpperCase()} ·{" "}
              {formatFileSize(selectedFile.file.size)}
            </p>
            {selectedFile.error && (
              <p className="flex items-center gap-1.5 text-xs text-destructive mt-1.5">
                <AlertCircle className="size-3 shrink-0" />
                {selectedFile.error}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!selectedFile.error && (
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {uploading && (
                  <svg
                    className="size-3.5 motion-safe:animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {uploading ? "Uploading…" : "Upload"}
              </button>
            )}
            <button
              type="button"
              onClick={clearFile}
              className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Remove selected file"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.epub"
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Status message */}
      <div aria-live="polite" role="status">
        {message && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            {message.text}
          </div>
        )}
      </div>
    </form>
  );
}
