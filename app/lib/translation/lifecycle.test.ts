import { createServer } from "node:http";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import AdmZip from "adm-zip";
import "dotenv/config";

// ── In-memory storage mock ──────────────────────────────────────────
// Maps storage keys → Buffers so the test never touches R2.
const storageMap = new Map<string, Buffer>();

vi.mock("@/app/lib/storage", () => ({
    readNovelFile: async (key: string) => {
      const buf = storageMap.get(key);
      if (!buf) throw new Error(`Mock storage: key not found: ${key}`);
      return buf;
    },
    writeNovelFile: async (key: string, buffer: Buffer) => {
      storageMap.set(key, buffer);
      return key;
    },
    generateStorageKey: (originalFileName: string) => {
      const ext = originalFileName.includes(".")
        ? originalFileName.slice(originalFileName.lastIndexOf("."))
        : "";
      return `novels/test-${Date.now()}${ext}`;
    },
    deleteNovelFile: async () => {},
}));

// Also mock the export module so finalization doesn't hit R2.
const exportDir = join(process.cwd(), "storage", "test-exports");
vi.mock("@/app/lib/translation/export", () => ({
  writeTranslatedExportFile: async (input: {
    translationId: string;
    novelTitle: string;
    targetLanguage: string;
    chapters: Array<{ chapterIndex: number; translatedTitle: string | null; translatedContent: string | null }>;
  }) => {
    await mkdir(exportDir, { recursive: true });
    const fileName = `${input.translationId}.txt`;
    const filePath = join(exportDir, fileName);
    const content = input.chapters
      .map((ch) => `${ch.translatedTitle}\n${ch.translatedContent}`)
      .join("\n\n");
    await writeFile(filePath, content, "utf8");
    return { fileName, filePath };
  },
  canDownloadTranslationExport: (input: { status: string; exportPath: string | null }) => {
    return input.status === "COMPLETED" && Boolean(input.exportPath);
  },
  buildTranslatedExportText: () => "",
  readTranslatedExportFile: async () => Buffer.alloc(0),
  deleteTranslatedExportFile: async () => {},
}));

// Mock the pub/sub publisher so lifecycle tests don't attempt real Redis connections.
// M004 introduced publishChapterTranslated into runTranslationJob — this mock ensures
// the integration test still exercises the full translation pipeline without Redis.
vi.mock("@/app/lib/translation/pubsub", () => ({
  publishChapterTranslated: vi.fn().mockResolvedValue(undefined),
}));

import { createNovel } from "@/app/lib/novels";
import { prisma } from "@/app/lib/prisma";
import { createTranslationProfile } from "@/app/lib/translation/profiles";
import {
  createTranslationJobFromNovelDetails,
  retryTranslationJob,
  runTranslationJob,
} from "@/app/lib/translation/service";

function buildMinimalEpubBuffer() {
  const zip = new AdmZip();
  zip.addFile("mimetype", Buffer.from("application/epub+zip", "utf8"));
  zip.addFile(
    "META-INF/container.xml",
    Buffer.from(
      `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`,
      "utf8"
    )
  );
  zip.addFile(
    "OEBPS/content.opf",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Lifecycle EPUB</dc:title>
    <dc:identifier id="bookid">lifecycle-epub</dc:identifier>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="chap1" href="chapter1.xhtml" media-type="application/xhtml+xml" />
    <item id="chap2" href="chapter2.xhtml" media-type="application/xhtml+xml" />
  </manifest>
  <spine>
    <itemref idref="chap1" />
    <itemref idref="chap2" />
  </spine>
</package>`,
      "utf8"
    )
  );
  zip.addFile(
    "OEBPS/chapter1.xhtml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>EPUB Chapter 1</title></head>
  <body><h1>EPUB Chapter 1</h1><p>First EPUB paragraph.</p></body>
</html>`,
      "utf8"
    )
  );
  zip.addFile(
    "OEBPS/chapter2.xhtml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>EPUB Chapter 2</title></head>
  <body><h1>EPUB Chapter 2</h1><p>Second EPUB paragraph.</p></body>
</html>`,
      "utf8"
    )
  );

  return zip.toBuffer();
}

// This integration test covers DB + HTTP + retry paths; keep an explicit timeout
// to avoid scheduler-related flakes when the full suite runs concurrently.
test("translation lifecycle works for txt/epub with failure and retry", async () => {
  process.env.TRANSLATION_ENCRYPTION_SECRET = "translation-lifecycle-test-secret";

  const TEST_USER_ID = "lifecycle-test-user";
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      email: `lifecycle-test-${Date.now()}@test.local`,
      name: "Lifecycle Test User",
    },
  });

  const createdNovelIds: string[] = [];
  const exportPaths = new Set<string>();
  const failedTitleCount = new Map<string, number>();
  let allowRetryJobToSucceed = false;

  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
      response.statusCode = 404;
      response.end("not-found");
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
    }

    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
      messages?: Array<{ role?: string; content?: string }>;
    };

    const userMessage = body.messages?.find((message) => message.role === "user")?.content ?? "";
    const titleMatch = userMessage.match(/Chapter title[^\n]*:\n([^\n]+)/);
    const sourceTitle = titleMatch?.[1]?.trim() ?? "Unknown Chapter";

    if (sourceTitle === "EPUB Chapter 1" && !allowRetryJobToSucceed) {
      const count = (failedTitleCount.get(sourceTitle) ?? 0) + 1;
      failedTitleCount.set(sourceTitle, count);
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ error: "forced-failure" }));
      return;
    }

    const payload = {
      translatedTitle: `${sourceTitle} (VI)`,
      translatedContent: `Translated content for ${sourceTitle}`,
    };

    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify(payload),
            },
          },
        ],
      })
    );
  });

  const serverPort = await new Promise<number>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve((server.address() as { port: number }).port);
    });
  });

  try {
    const profile = await createTranslationProfile({
      provider: "OPENAI",
      model: "mock-chat-model",
      baseUrl: `http://127.0.0.1:${serverPort}/v1`,
      apiKey: "mock-api-key",
    }, TEST_USER_ID);

    expect(profile.id).toBeTruthy();
    expect("encryptedApiKey" in profile).toBe(false);
    expect("apiKey" in profile).toBe(false);

    const txtStorageKey = `novels/test-lifecycle-txt-${Date.now()}.txt`;
    storageMap.set(
      txtStorageKey,
      Buffer.from(`Chapter 1\nA plain text opening.\n\nChapter 2\nA plain text continuation.\n`, "utf8")
    );

    const txtNovel = await createNovel({
      title: "Lifecycle TXT",
      originalFileName: "lifecycle.txt",
      fileType: "txt",
      mimeType: "text/plain",
      sizeBytes: 100,
      storagePath: txtStorageKey,
      userId: TEST_USER_ID,
    });
    createdNovelIds.push(txtNovel.id);

    const txtJobCreated = await createTranslationJobFromNovelDetails({
      novelId: txtNovel.id,
      profileId: profile.id,
      userId: TEST_USER_ID,
    });

    const txtJob = await runTranslationJob({
      translationId: txtJobCreated.id,
      profileId: profile.id,
      userId: TEST_USER_ID,
    });

    expect(txtJob.status).toBe("COMPLETED");
    expect(txtJob.exportPath).toBeTruthy();
    expect(txtJob.downloadUrl).toBeTruthy();
    exportPaths.add(txtJob.exportPath!);

    const epubStorageKey = `novels/test-lifecycle-epub-${Date.now()}.epub`;
    storageMap.set(epubStorageKey, buildMinimalEpubBuffer());

    const epubNovel = await createNovel({
      title: "Lifecycle EPUB",
      originalFileName: "lifecycle.epub",
      fileType: "epub",
      mimeType: "application/epub+zip",
      sizeBytes: 200,
      storagePath: epubStorageKey,
      userId: TEST_USER_ID,
    });
    createdNovelIds.push(epubNovel.id);

    const epubJobCreated = await createTranslationJobFromNovelDetails({
      novelId: epubNovel.id,
      profileId: profile.id,
      userId: TEST_USER_ID,
    });

    const failedJob = await runTranslationJob({
      translationId: epubJobCreated.id,
      profileId: profile.id,
      userId: TEST_USER_ID,
    });

    expect(failedJob.status).toBe("FAILED");
    expect(failedJob.failedChapterIndex).toBe(1);
    expect(failedJob.failureReason).toBeTruthy();

    allowRetryJobToSucceed = true;

    await retryTranslationJob({
      translationId: failedJob.id,
      profileId: profile.id,
      userId: TEST_USER_ID,
    });

    const recoveredJob = await runTranslationJob({
      translationId: failedJob.id,
      profileId: profile.id,
      allowFailedState: true,
      userId: TEST_USER_ID,
    });

    expect(recoveredJob.status).toBe("COMPLETED");
    expect(recoveredJob.exportPath).toBeTruthy();
    expect(recoveredJob.downloadUrl).toBeTruthy();
    exportPaths.add(recoveredJob.exportPath!);

    // Export paths are local files from the mock writeTranslatedExportFile
    for (const ep of exportPaths) {
      const { access } = await import("node:fs/promises");
      await access(ep);
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    for (const novelId of createdNovelIds) {
      await prisma.novel.deleteMany({ where: { id: novelId } });
    }

    await prisma.translationProfile.deleteMany({
      where: {
        model: "mock-chat-model",
      },
    });

    for (const ep of exportPaths) {
      await rm(ep, { force: true });
    }

    await rm(exportDir, { recursive: true, force: true });
    storageMap.clear();
  }
}, 15_000);
