import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  updateGlossaryEntry,
  deleteGlossaryEntry,
  updateGlossaryEntryStatus,
} from "@/app/lib/translation/glossary";
import { handleTranslationRouteError, safeReadJson } from "@/app/lib/translation/http";
import { GlossaryEntryStatus, GlossaryEntryType } from "@/app/generated/prisma/client";
import { apiLimiter, getClientIp, rateLimitResponse } from "@/app/lib/rate-limit";

export async function PUT(
  request: Request,
  context: { params: Promise<{ novelId: string; entryId: string }> }
) {
  try {
    const ip = getClientIp(request);
    const rl = apiLimiter.check(ip);
    if (!rl.allowed) return rateLimitResponse(rl);

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { entryId } = await context.params;
    const body = await safeReadJson(request) as {
      canonical?: string;
      type?: string;
      variants?: string[];
    };

    const type = body.type?.toUpperCase() as GlossaryEntryType | undefined;
    if (type && !Object.values(GlossaryEntryType).includes(type)) {
      return NextResponse.json({ error: "Invalid type." }, { status: 400 });
    }

    const variants = body.variants !== undefined
      ? (Array.isArray(body.variants)
        ? body.variants.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        : undefined)
      : undefined;

    const entry = await updateGlossaryEntry({
      entryId,
      canonical: body.canonical?.trim(),
      type,
      variants,
      userId: session.user.id,
    });

    return NextResponse.json({ entry });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ novelId: string; entryId: string }> }
) {
  try {
    const ip = getClientIp(request);
    const rl = apiLimiter.check(ip);
    if (!rl.allowed) return rateLimitResponse(rl);

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { entryId } = await context.params;
    await deleteGlossaryEntry(entryId, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ novelId: string; entryId: string }> }
) {
  try {
    const ip = getClientIp(request);
    const rl = apiLimiter.check(ip);
    if (!rl.allowed) return rateLimitResponse(rl);

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { entryId } = await context.params;
    const body = await safeReadJson(request) as {
      status?: string;
      canonical?: string;
      type?: string;
      variants?: string[];
    };

    if (!body.status || !["CONFIRMED", "DISMISSED"].includes(body.status.toUpperCase())) {
      return NextResponse.json(
        { error: "status must be CONFIRMED or DISMISSED." },
        { status: 400 }
      );
    }

    const isDismissed = body.status.toUpperCase() === "DISMISSED";

    if (isDismissed) {
      await deleteGlossaryEntry(entryId, session.user.id);
      return NextResponse.json({ entry: null });
    }

    const type = body.type?.toUpperCase() as GlossaryEntryType | undefined;
    const variants = body.variants !== undefined
      ? (Array.isArray(body.variants)
        ? body.variants.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        : undefined)
      : undefined;

    const entry = await updateGlossaryEntryStatus({
      entryId,
      status: GlossaryEntryStatus.CONFIRMED,
      canonical: body.canonical?.trim(),
      type,
      variants,
      userId: session.user.id,
    });

    return NextResponse.json({ entry });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
