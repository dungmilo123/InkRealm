import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateUploadClient } from "./upload-validation";

function fakeFile(overrides: {
  name?: string;
  type?: string;
  size?: number;
}): File {
  const name = overrides.name ?? "novel.txt";
  const type = overrides.type ?? "text/plain";
  const size = overrides.size ?? 1024;
  // Create a minimal File-like object — enough for validation logic
  const blob = new Blob(["x".repeat(Math.min(size, 100))], { type });
  const file = new File([blob], name, { type });
  // Override size getter since Blob.size reflects actual content, not our intended size
  Object.defineProperty(file, "size", { value: size, writable: false });
  return file;
}

describe("validateUploadClient", () => {
  it("accepts a valid .txt file", () => {
    const result = validateUploadClient(fakeFile({ name: "novel.txt", type: "text/plain" }));
    assert.equal(result.valid, true);
    assert.equal(result.error, undefined);
  });

  it("accepts a valid .epub file", () => {
    const result = validateUploadClient(fakeFile({ name: "book.epub", type: "application/epub+zip" }));
    assert.equal(result.valid, true);
    assert.equal(result.error, undefined);
  });

  it("rejects unsupported extensions", () => {
    const result = validateUploadClient(fakeFile({ name: "doc.pdf", type: "application/pdf" }));
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes(".pdf"));
  });

  it("rejects files with no extension", () => {
    const result = validateUploadClient(fakeFile({ name: "README", type: "" }));
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("unknown"));
  });

  it("rejects wrong MIME type when present", () => {
    const result = validateUploadClient(fakeFile({ name: "novel.txt", type: "application/pdf" }));
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("application/pdf"));
  });

  it("allows empty MIME type (some browsers do this)", () => {
    const result = validateUploadClient(fakeFile({ name: "novel.txt", type: "" }));
    assert.equal(result.valid, true);
  });

  it("rejects files over 50 MB", () => {
    const result = validateUploadClient(fakeFile({ size: 51 * 1024 * 1024 }));
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("too large"));
  });

  it("accepts files exactly at 50 MB", () => {
    const result = validateUploadClient(fakeFile({ size: 50 * 1024 * 1024 }));
    assert.equal(result.valid, true);
  });

  it("rejects empty files (0 bytes)", () => {
    const result = validateUploadClient(fakeFile({ size: 0 }));
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("empty"));
  });

  it("handles uppercase extensions correctly", () => {
    const result = validateUploadClient(fakeFile({ name: "BOOK.EPUB", type: "application/epub+zip" }));
    assert.equal(result.valid, true);
  });

  it("rejects .txt.exe double extension tricks", () => {
    const result = validateUploadClient(fakeFile({ name: "novel.txt.exe", type: "" }));
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes(".exe"));
  });
});
