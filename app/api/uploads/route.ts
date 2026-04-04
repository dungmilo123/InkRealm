import { NextResponse } from "next/server";
import { validateUpload } from "@/app/lib/validation";
import { generateStorageKey, writeNovelFile, deleteNovelFile } from "@/app/lib/storage";
import { createNovel } from "@/app/lib/novels";
import { requireAuth } from "@/app/lib/require-auth";
import {
  uploadLimiter,
  getClientIp,
  rateLimitResponse,
} from "@/app/lib/rate-limit";

const VALID_FILE_TYPES = ["txt", "epub"];

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "epub") return "application/epub+zip";
  if (ext === "txt") return "text/plain";
  return "application/octet-stream";
}

function getFileType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (VALID_FILE_TYPES.includes(ext)) return ext;
  return "unknown";
}

function sanitizeTitle(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^/.]+$/, "");
  return withoutExt
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim() || "Untitled";
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = uploadLimiter.check(ip);
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    const { session, response } = await requireAuth();
    if (response) return response;
    const formData = await request.formData();
    const allFileEntries = Array.from(formData.values()).filter(
      (value): value is File => value instanceof File
    );
    const uploadFieldEntries = formData
      .getAll("file")
      .filter((value): value is File => value instanceof File);

    if (allFileEntries.length !== 1 || uploadFieldEntries.length !== 1) {
      return NextResponse.json(
        { error: "Exactly one novel file is required" },
        { status: 400 }
      );
    }

    const file = uploadFieldEntries[0];

    const validation = validateUpload(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = generateStorageKey(file.name);
    let storagePath: string;

    try {
      storagePath = await writeNovelFile(storageKey, buffer);
    } catch (storageError) {
      console.error("Failed to store uploaded file", {
        fileName: file.name,
        error: storageError,
      });
      return NextResponse.json(
        { error: "Failed to store file" },
        { status: 500 }
      );
    }

    try {
      const novel = await createNovel({
        title: sanitizeTitle(file.name),
        originalFileName: file.name,
        fileType: getFileType(file.name),
        mimeType: file.type || getMimeType(file.name),
        sizeBytes: file.size,
        storagePath,
        userId: session.user.id,
      });

      try {
        const { getReaderDocument } = await import("@/app/lib/reader");
        const doc = await getReaderDocument(novel);
        const { updateNovelChapterCount } = await import("@/app/lib/novels");
        await updateNovelChapterCount(novel.id, doc.chapterCount);
        novel.chapterCount = doc.chapterCount;
      } catch {
        // intentional: chapter parsing failure is non-fatal; dashboard lazy-populates
      }

      return NextResponse.json({ success: true, novel }, { status: 201 });
    } catch (dbError) {
      try {
        await deleteNovelFile(storagePath);
      } catch (cleanupError) {
        console.error("Failed to clean up uploaded file after DB error", {
          storagePath,
          error: cleanupError,
        });
      }

      console.error("Failed to create novel database record", {
        fileName: file.name,
        error: dbError,
      });

      return NextResponse.json(
        { error: "Failed to create database record" },
        { status: 500 }
      );
    }
  } catch (requestError) {
    console.error("Invalid upload request", { error: requestError });
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
