import AdmZip from "adm-zip";
import type { ExportChapter } from "./export";

/**
 * Generates a valid EPUB 3 file (as a Buffer) from translated chapters.
 *
 * EPUB is essentially a ZIP archive with a specific structure:
 *   mimetype              — must be first entry, uncompressed
 *   META-INF/container.xml — points to the OPF package document
 *   OEBPS/content.opf     — manifest + spine (reading order)
 *   OEBPS/toc.xhtml       — navigation document (table of contents)
 *   OEBPS/chapter-N.xhtml — one file per chapter
 */

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function contentToXhtmlParagraphs(content: string): string {
  if (!content.trim()) return "<p></p>";

  return content
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `    <p>${escapeXml(para)}</p>`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// EPUB structural files
// ---------------------------------------------------------------------------

function buildMimetype(): string {
  return "application/epub+zip";
}

function buildContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

function buildContentOpf(input: {
  title: string;
  language: string;
  identifier: string;
  chapters: { index: number; title: string }[];
}): string {
  const manifestItems = input.chapters
    .map(
      (ch) =>
        `    <item id="chapter-${ch.index}" href="chapter-${ch.index}.xhtml" media-type="application/xhtml+xml"/>`
    )
    .join("\n");

  const spineItems = input.chapters
    .map((ch) => `    <itemref idref="chapter-${ch.index}"/>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${escapeXml(input.identifier)}</dc:identifier>
    <dc:title>${escapeXml(input.title)}</dc:title>
    <dc:language>${escapeXml(input.language)}</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${manifestItems}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>`;
}

function buildTocXhtml(input: {
  title: string;
  chapters: { index: number; title: string }[];
}): string {
  const navItems = input.chapters
    .map(
      (ch) =>
        `      <li><a href="chapter-${ch.index}.xhtml">${escapeXml(ch.title)}</a></li>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXml(input.title)}</title>
</head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
${navItems}
    </ol>
  </nav>
</body>
</html>`;
}

function buildChapterXhtml(input: {
  title: string;
  content: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(input.title)}</title>
  <style>
    body { font-family: serif; line-height: 1.6; margin: 1em; }
    h1 { font-size: 1.4em; margin-bottom: 1em; }
    p { text-indent: 1.5em; margin: 0.5em 0; }
  </style>
</head>
<body>
  <h1>${escapeXml(input.title)}</h1>
${contentToXhtmlParagraphs(input.content)}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a valid EPUB 3 buffer from translated chapter data.
 * No temp files needed — everything is assembled in memory.
 */
export function buildTranslatedEpub(input: {
  translationId: string;
  novelTitle: string;
  targetLanguage: string;
  chapters: ExportChapter[];
}): Buffer {
  const ordered = [...input.chapters].sort(
    (left, right) => left.chapterIndex - right.chapterIndex
  );

  const chapterMeta = ordered.map((ch) => ({
    index: ch.chapterIndex,
    title: ch.translatedTitle ?? `Chapter ${ch.chapterIndex}`,
  }));

  const displayTitle = `${input.novelTitle} (${input.targetLanguage} translation)`;
  const identifier = `inkrealm-translation-${input.translationId}`;

  const zip = new AdmZip();

  // 1. mimetype — MUST be the first entry, stored uncompressed (EPUB spec requirement)
  zip.addFile("mimetype", Buffer.from(buildMimetype(), "utf-8"), "", 0x0000);

  // 2. META-INF/container.xml
  zip.addFile(
    "META-INF/container.xml",
    Buffer.from(buildContainerXml(), "utf-8")
  );

  // 3. OEBPS/content.opf
  zip.addFile(
    "OEBPS/content.opf",
    Buffer.from(
      buildContentOpf({
        title: displayTitle,
        language: input.targetLanguage === "Vietnamese" ? "vi" : "en",
        identifier,
        chapters: chapterMeta,
      }),
      "utf-8"
    )
  );

  // 4. OEBPS/toc.xhtml (navigation document)
  zip.addFile(
    "OEBPS/toc.xhtml",
    Buffer.from(
      buildTocXhtml({ title: displayTitle, chapters: chapterMeta }),
      "utf-8"
    )
  );

  // 5. One XHTML file per chapter
  for (const ch of ordered) {
    const title = ch.translatedTitle ?? `Chapter ${ch.chapterIndex}`;
    const content = ch.translatedContent ?? "";
    zip.addFile(
      `OEBPS/chapter-${ch.chapterIndex}.xhtml`,
      Buffer.from(buildChapterXhtml({ title, content }), "utf-8")
    );
  }

  return zip.toBuffer();
}
