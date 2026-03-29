import { basename } from "path";
import { NextResponse } from "next/server";
import { readTranslatedExportFile } from "@/app/lib/translation/export";
import { TranslationHttpError } from "@/app/lib/translation/errors";
import { handleTranslationRouteError } from "@/app/lib/translation/http";
import { getDownloadableTranslationJob } from "@/app/lib/translation/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ translationId: string }> }
) {
  try {
    const { translationId } = await context.params;
    const job = await getDownloadableTranslationJob(translationId);

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
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
      },
    });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
