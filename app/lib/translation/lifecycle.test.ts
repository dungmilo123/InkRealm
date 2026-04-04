import assert from "node:assert/strict";
import { createServer } from "node:http";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import AdmZip from "adm-zip";
import "dotenv/config";
import { createNovel } from "@/app/lib/novels";
import { prisma } from "@/app/lib/prisma";
import { createTranslationProfile } from "@/app/lib/translation/profiles";
import {
  createTranslationJobFromNovelDetails,
  retryTranslationJob,
  runTranslationJobBatch,
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

test("translation lifecycle works for txt/epub with failure and retry", async () => {
  process.env.TRANSLATION_ENCRYPTION_SECRET = "translation-lifecycle-test-secret";

  const storageDir = join(process.cwd(), "storage", "novels", "translation-tests");
  await mkdir(storageDir, { recursive: true });

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
  const createdFilePaths: string[] = [];
  const exportPaths = new Set<string>();
  const failedTitleOnce = new Set<string>();

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

    if (sourceTitle === "EPUB Chapter 1" && !failedTitleOnce.has(sourceTitle)) {
      failedTitleOnce.add(sourceTitle);
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

    assert.ok(profile.id);
    assert.equal("encryptedApiKey" in profile, false);
    assert.equal("apiKey" in profile, false);

    const txtPath = join(storageDir, "lifecycle.txt");
    await writeFile(
      txtPath,
      `Chapter 1\nA plain text opening.\n\nChapter 2\nA plain text continuation.\n`,
      "utf8"
    );
    createdFilePaths.push(txtPath);

    const txtNovel = await createNovel({
      title: "Lifecycle TXT",
      originalFileName: "lifecycle.txt",
      fileType: "txt",
      mimeType: "text/plain",
      sizeBytes: 100,
      storagePath: txtPath,
      userId: TEST_USER_ID,
    });
    createdNovelIds.push(txtNovel.id);

    const txtJobCreated = await createTranslationJobFromNovelDetails({
      novelId: txtNovel.id,
      profileId: profile.id,
      userId: TEST_USER_ID,
    });

    const txtJob = await runTranslationJobBatch({
      translationId: txtJobCreated.id,
      profileId: profile.id,
      userId: TEST_USER_ID,
    });

    assert.notEqual(txtJob, "continue", "Expected completed job, not continuation");
    if (txtJob === "continue") throw new Error("unreachable");
    assert.equal(txtJob.status, "COMPLETED");
    assert.ok(txtJob.exportPath);
    assert.ok(txtJob.downloadUrl);
    exportPaths.add(txtJob.exportPath!);

    const epubPath = join(storageDir, "lifecycle.epub");
    await writeFile(epubPath, buildMinimalEpubBuffer());
    createdFilePaths.push(epubPath);

    const epubNovel = await createNovel({
      title: "Lifecycle EPUB",
      originalFileName: "lifecycle.epub",
      fileType: "epub",
      mimeType: "application/epub+zip",
      sizeBytes: 200,
      storagePath: epubPath,
      userId: TEST_USER_ID,
    });
    createdNovelIds.push(epubNovel.id);

    const epubJobCreated = await createTranslationJobFromNovelDetails({
      novelId: epubNovel.id,
      profileId: profile.id,
      userId: TEST_USER_ID,
    });

    const failedJob = await runTranslationJobBatch({
      translationId: epubJobCreated.id,
      profileId: profile.id,
      userId: TEST_USER_ID,
    });

    assert.notEqual(failedJob, "continue", "Expected failed job, not continuation");
    if (failedJob === "continue") throw new Error("unreachable");
    assert.equal(failedJob.status, "FAILED");
    assert.equal(failedJob.failedChapterIndex, 1);
    assert.ok(failedJob.failureReason);

    await retryTranslationJob({
      translationId: failedJob.id,
      profileId: profile.id,
      userId: TEST_USER_ID,
    });

    const recoveredJob = await runTranslationJobBatch({
      translationId: failedJob.id,
      profileId: profile.id,
      userId: TEST_USER_ID,
    });

    assert.notEqual(recoveredJob, "continue", "Expected completed job, not continuation");
    if (recoveredJob === "continue") throw new Error("unreachable");
    assert.equal(recoveredJob.status, "COMPLETED");
    assert.ok(recoveredJob.exportPath);
    assert.ok(recoveredJob.downloadUrl);
    exportPaths.add(recoveredJob.exportPath!);

    for (const exportPath of exportPaths) {
      await access(exportPath);
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

    for (const filePath of [...createdFilePaths, ...exportPaths]) {
      await rm(filePath, { force: true });
    }

    await rm(storageDir, { recursive: true, force: true });
  }
});
