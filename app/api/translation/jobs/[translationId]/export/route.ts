import { basename } from "path";
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/require-auth";
import { readTranslatedExportFile } from "@/app/lib/translation/export";
import { TranslationHttpError } from "@/app/lib/translation/errors";
import { handleTranslationRouteError } from "@/app/lib/translation/http";
import {
  getDownloadableTranslationJob,
  buildEpubExportForJob,
} from "@/app/lib/translation/service";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

const VALID_FORMATS = new Set(["txt", "epub"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ translationId: string }> }
) {
  try {
    const ip = getClientIp(request);
    const rl = apiLimiter.check(ip);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { session, response } = await requireAuth();
    if (response) return response;

    const { translationId } = await context.params;
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "txt";

    if (!VALID_FORMATS.has(format)) {
      return NextResponse.json(
        { error: `Unsupported format: ${format}. Use "txt" or "epub".` },
        { status: 400 }
      );
    }

    const job = await getDownloadableTranslationJob(translationId, session.user.id);

    if (format === "epub") {
      const { buffer, fileName } = await buildEpubExportForJob(
        translationId,
        job.novelId
      );

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/epub+zip",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    // Default: TXT format (pre-generated file on disk)
    let fileBuffer: Buffer;
    try {
      fileBuffer = await readTranslatedExportFile(job.exportPath!);
    } catch {
      throw new TranslationHttpError(404, "Translation export file was not found.");
    }

    const filename = basename(job.exportPath!);
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
