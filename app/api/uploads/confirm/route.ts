import { NextResponse } from "next/server";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createNovel } from "@/app/lib/novels";
import { requireAuth } from "@/app/lib/require-auth";
import { deleteNovelFile } from "@/app/lib/storage";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "inkrealm-novel-storage";

const VALID_FILE_TYPES = ["txt", "epub"];

function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) return "";
  return filename.slice(lastDot + 1).toLowerCase();
}

function getMimeType(fileName: string): string {
  const ext = getExtension(fileName);
  if (ext === "epub") return "application/epub+zip";
  if (ext === "txt") return "text/plain";
  return "application/octet-stream";
}

function getFileType(fileName: string): string {
  const ext = getExtension(fileName);
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

/**
 * Confirm a direct upload and create the database record.
 * Called after the client uploads directly to R2 using a presigned URL.
 */
export async function POST(request: Request) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;

    const body = await request.json() as {
      storageKey?: string;
      originalFileName?: string;
    };

    const { storageKey, originalFileName } = body;

    if (!storageKey || typeof storageKey !== "string") {
      return NextResponse.json(
        { error: "storageKey is required" },
        { status: 400 }
      );
    }

    if (!originalFileName || typeof originalFileName !== "string") {
      return NextResponse.json(
        { error: "originalFileName is required" },
        { status: 400 }
      );
    }

    // Verify the file exists in R2
    const client = getR2Client();
    let objectInfo;
    try {
      objectInfo = await client.send(
        new HeadObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: storageKey,
        })
      );
    } catch {
      return NextResponse.json(
        { error: "File not found. Upload may have failed or expired." },
        { status: 404 }
      );
    }

    const fileSize = objectInfo.ContentLength ?? 0;

    // Create the database record
    try {
      const novel = await createNovel({
        title: sanitizeTitle(originalFileName),
        originalFileName,
        fileType: getFileType(originalFileName),
        mimeType: objectInfo.ContentType || getMimeType(originalFileName),
        sizeBytes: fileSize,
        storagePath: storageKey,
        userId: session.user.id,
      });

      // Try to parse chapters (non-fatal if it fails)
      try {
        const { getReaderDocument } = await import("@/app/lib/reader");
        const doc = await getReaderDocument(novel);
        const { updateNovelChapterCount } = await import("@/app/lib/novels");
        await updateNovelChapterCount(novel.id, doc.chapterCount);
        novel.chapterCount = doc.chapterCount;
      } catch {
        // Chapter parsing failure is non-fatal; dashboard lazy-populates
      }

      return NextResponse.json({ success: true, novel }, { status: 201 });
    } catch (dbError) {
      // Clean up the uploaded file if DB creation fails
      try {
        await deleteNovelFile(storageKey);
      } catch (cleanupError) {
        console.error("Failed to clean up uploaded file after DB error", {
          storageKey,
          error: cleanupError,
        });
      }

      console.error("Failed to create novel database record", {
        originalFileName,
        error: dbError,
      });

      return NextResponse.json(
        { error: "Failed to create database record" },
        { status: 500 }
      );
    }
  } catch (requestError) {
    console.error("Invalid confirm request", { error: requestError });
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
