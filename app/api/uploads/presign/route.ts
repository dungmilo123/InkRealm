import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { requireAuth } from "@/app/lib/require-auth";
import {
  uploadLimiter,
  getClientIp,
  rateLimitResponse,
} from "@/app/lib/rate-limit";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "inkrealm-novel-storage";

const VALID_FILE_TYPES = ["txt", "epub"];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

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

function getContentType(ext: string): string {
  if (ext === "epub") return "application/epub+zip";
  if (ext === "txt") return "text/plain";
  return "application/octet-stream";
}

/**
 * Generate a presigned URL for direct-to-R2 uploads.
 * This bypasses Vercel's 4.5MB body size limit.
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = uploadLimiter.check(ip);
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    const { response } = await requireAuth();
    if (response) return response;

    const body = await request.json() as { fileName?: string; fileSize?: number };
    const { fileName, fileSize } = body;

    if (!fileName || typeof fileName !== "string") {
      return NextResponse.json(
        { error: "fileName is required" },
        { status: 400 }
      );
    }

    if (!fileSize || typeof fileSize !== "number" || fileSize <= 0) {
      return NextResponse.json(
        { error: "fileSize is required and must be positive" },
        { status: 400 }
      );
    }

    const ext = getExtension(fileName);
    if (!VALID_FILE_TYPES.includes(ext)) {
      return NextResponse.json(
        { error: `Invalid file type ".${ext || "unknown"}". Allowed: .txt, .epub` },
        { status: 400 }
      );
    }

    if (fileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size: 50 MB` },
        { status: 400 }
      );
    }

    const uploadId = randomUUID();
    const storageKey = `novels/${uploadId}.${ext}`;
    const contentType = getContentType(ext);

    const client = getR2Client();
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(client, command, {
      expiresIn: 300, // 5 minutes
    });

    return NextResponse.json({
      uploadId,
      presignedUrl,
      storageKey,
      contentType,
    });
  } catch (error) {
    console.error("Failed to generate presigned URL", { error });
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
