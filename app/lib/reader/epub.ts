import AdmZip from "adm-zip";
import { posix as pathPosix } from "path";
import { XMLParser } from "fast-xml-parser";
import type { ParsedReaderChapter } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined) {
    return [];
  }

  return [value];
}

function readZipText(zip: AdmZip, entryPath: string): string | null {
  const normalized = entryPath.replace(/\\/g, "/");
  const entry = zip.getEntry(normalized);

  if (!entry) {
    return null;
  }

  return entry.getData().toString("utf-8");
}

function decodeEntity(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x[\da-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, token: string) => {
    const lowerToken = token.toLowerCase();

    if (lowerToken.startsWith("#x")) {
      const codePoint = Number.parseInt(lowerToken.slice(2), 16);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    if (lowerToken.startsWith("#")) {
      const codePoint = Number.parseInt(lowerToken.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    return namedEntities[lowerToken] ?? match;
  });
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);
}

function extractFirstMatch(value: string, expression: RegExp): string {
  const match = value.match(expression);
  return match?.[1] ?? "";
}

function extractChapterText(markup: string): { title: string; paragraphs: string[] } {
  const body = extractFirstMatch(markup, /<body[^>]*>([\s\S]*?)<\/body>/i) || markup;
  const headingFromBody =
    extractFirstMatch(body, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    extractFirstMatch(body, /<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const titleFromDocument = extractFirstMatch(markup, /<title[^>]*>([\s\S]*?)<\/title>/i);

  const cleanedBody = body
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|blockquote|li|h1|h2|h3|h4|h5|h6|tr)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ");

  const decodedBody = normalizeText(decodeEntity(cleanedBody));
  const paragraphs = splitParagraphs(decodedBody);
  const title = normalizeText(decodeEntity(stripTags(headingFromBody || titleFromDocument)));

  return { title, paragraphs };
}

function isReadableDocument(item: ManifestItem): boolean {
  return (
    item.mediaType === "application/xhtml+xml" ||
    item.mediaType === "text/html" ||
    item.href.toLowerCase().endsWith(".xhtml") ||
    item.href.toLowerCase().endsWith(".html") ||
    item.href.toLowerCase().endsWith(".htm")
  );
}

function parseManifest(manifestNode: unknown): ManifestItem[] {
  const rawItems = asArray((manifestNode as { item?: unknown })?.item as unknown);

  return rawItems
    .map((item) => {
      const rawItem = item as {
        "@_id"?: string;
        "@_href"?: string;
        "@_media-type"?: string;
        "@_properties"?: string;
      };

      const id = rawItem["@_id"]?.trim();
      const href = rawItem["@_href"]?.trim();
      const mediaType = rawItem["@_media-type"]?.trim() ?? "";
      const properties = rawItem["@_properties"]?.trim();

      if (!id || !href) {
        return null;
      }

      return { id, href, mediaType, ...(properties ? { properties } : {}) };
    })
    .filter((item): item is ManifestItem => item !== null);
}

export function extractEpubCover(
  buffer: Buffer,
): { data: Buffer; mediaType: string } | null {
  let zip: AdmZip;

  try {
    zip = new AdmZip(buffer);
  } catch {
    return null;
  }

  const containerXml = readZipText(zip, "META-INF/container.xml");
  if (!containerXml) {
    return null;
  }

  const containerDocument = parser.parse(containerXml) as {
    container?: {
      rootfiles?: {
        rootfile?: { "@_full-path"?: string } | Array<{ "@_full-path"?: string }>;
      };
    };
  };

  const rootfiles = asArray(containerDocument.container?.rootfiles?.rootfile);
  const rootfilePath = rootfiles[0]?.["@_full-path"];
  if (!rootfilePath) {
    return null;
  }

  const opfXml = readZipText(zip, rootfilePath);
  if (!opfXml) {
    return null;
  }

  const packageDocument = parser.parse(opfXml) as {
    package?: {
      metadata?: {
        meta?:
          | { "@_name"?: string; "@_content"?: string }
          | Array<{ "@_name"?: string; "@_content"?: string }>;
      };
      manifest?: unknown;
    };
  };

  const manifestItems = parseManifest(packageDocument.package?.manifest);
  const manifestById = new Map(manifestItems.map((item) => [item.id, item]));
  const opfDirectory = pathPosix.dirname(rootfilePath);

  // EPUB3: manifest item with properties="cover-image"
  const epub3Cover = manifestItems.find(
    (item) =>
      item.properties === "cover-image" && item.mediaType.startsWith("image/"),
  );

  // EPUB2: <meta name="cover" content="id">
  let epub2Cover: ManifestItem | undefined;
  const metaNodes = asArray(packageDocument.package?.metadata?.meta);
  for (const meta of metaNodes) {
    if (meta["@_name"]?.toLowerCase() === "cover" && meta["@_content"]) {
      epub2Cover = manifestById.get(meta["@_content"]);
      break;
    }
  }

  // Fallback: first manifest item whose id or href starts with "cover" and is an image
  const fallbackCover = manifestItems.find(
    (item) =>
      item.mediaType.startsWith("image/") &&
      (item.id.toLowerCase().startsWith("cover") ||
        pathPosix.basename(item.href).toLowerCase().startsWith("cover")),
  );

  const coverItem = epub3Cover ?? epub2Cover ?? fallbackCover;
  if (!coverItem) {
    return null;
  }

  const entryPath = pathPosix.normalize(pathPosix.join(opfDirectory, coverItem.href));
  const normalized = entryPath.replace(/\\/g, "/");
  const entry = zip.getEntry(normalized);
  if (!entry) {
    return null;
  }

  return { data: entry.getData(), mediaType: coverItem.mediaType };
}

export function extractEpubChapters(buffer: Buffer): ParsedReaderChapter[] {
  let zip: AdmZip;

  try {
    zip = new AdmZip(buffer);
  } catch {
    return [];
  }

  const containerXml = readZipText(zip, "META-INF/container.xml");

  if (!containerXml) {
    return [];
  }

  const containerDocument = parser.parse(containerXml) as {
    container?: {
      rootfiles?: {
        rootfile?: { "@_full-path"?: string } | Array<{ "@_full-path"?: string }>;
      };
    };
  };

  const rootfiles = asArray(containerDocument.container?.rootfiles?.rootfile);
  const rootfilePath = rootfiles[0]?.["@_full-path"];

  if (!rootfilePath) {
    return [];
  }

  const opfXml = readZipText(zip, rootfilePath);
  if (!opfXml) {
    return [];
  }

  const packageDocument = parser.parse(opfXml) as {
    package?: {
      manifest?: unknown;
      spine?: {
        itemref?: { "@_idref"?: string } | Array<{ "@_idref"?: string }>;
      };
    };
  };

  const manifestItems = parseManifest(packageDocument.package?.manifest);
  const manifestById = new Map(manifestItems.map((item) => [item.id, item]));
  const readingOrder = asArray(packageDocument.package?.spine?.itemref)
    .map((item) => item["@_idref"]?.trim() ?? "")
    .filter((idref) => idref.length > 0);

  const opfDirectory = pathPosix.dirname(rootfilePath);
  const chapters: ParsedReaderChapter[] = [];
  const consumedFiles = new Set<string>();

  const addChapterFromPath = (entryPath: string, fallbackTitle: string) => {
    const markup = readZipText(zip, entryPath);
    if (!markup) {
      return;
    }

    const parsed = extractChapterText(markup);
    if (parsed.paragraphs.length === 0) {
      return;
    }

    chapters.push({
      title: parsed.title || fallbackTitle,
      paragraphs: parsed.paragraphs,
    });

    consumedFiles.add(entryPath);
  };

  for (const idref of readingOrder) {
    const manifestItem = manifestById.get(idref);
    if (!manifestItem || !isReadableDocument(manifestItem)) {
      continue;
    }

    const entryPath = pathPosix.normalize(pathPosix.join(opfDirectory, manifestItem.href));
    addChapterFromPath(entryPath, `Chapter ${chapters.length + 1}`);
  }

  if (chapters.length > 0) {
    return chapters;
  }

  for (const manifestItem of manifestItems) {
    if (!isReadableDocument(manifestItem)) {
      continue;
    }

    const entryPath = pathPosix.normalize(pathPosix.join(opfDirectory, manifestItem.href));
    if (consumedFiles.has(entryPath)) {
      continue;
    }

    addChapterFromPath(entryPath, `Chapter ${chapters.length + 1}`);
  }

  return chapters;
}
