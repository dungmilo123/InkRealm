import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  listGlossaryEntries,
  createGlossaryEntry,
} from "@/app/lib/translation/glossary";
import { handleTranslationRouteError, safeReadJson } from "@/app/lib/translation/http";
import { GlossaryEntryType } from "@/app/generated/prisma/client";

export async function GET(
  _request: Request,
  context: { params: Promise<{ novelId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { novelId } = await context.params;
    const entries = await listGlossaryEntries(novelId, session.user.id);
    return NextResponse.json({ entries });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ novelId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { novelId } = await context.params;
    const body = await safeReadJson(request) as {
      canonical?: string;
      type?: string;
      variants?: string[];
    };

    if (!body.canonical || typeof body.canonical !== "string" || !body.canonical.trim()) {
      return NextResponse.json({ error: "canonical is required." }, { status: 400 });
    }

    const type = (body.type?.toUpperCase() ?? "OTHER") as GlossaryEntryType;
    if (!Object.values(GlossaryEntryType).includes(type)) {
      return NextResponse.json({ error: "Invalid type." }, { status: 400 });
    }

    const variants = Array.isArray(body.variants)
      ? body.variants.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      : [];

    const entry = await createGlossaryEntry({
      novelId,
      canonical: body.canonical.trim(),
      type,
      variants,
      userId: session.user.id,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return handleTranslationRouteError(error);
  }
}
