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
    expect(result.valid).toBe(true);
    expect(result.error).toBe(undefined);
  });

  it("accepts a valid .epub file", () => {
    const result = validateUploadClient(fakeFile({ name: "book.epub", type: "application/epub+zip" }));
    expect(result.valid).toBe(true);
    expect(result.error).toBe(undefined);
  });

  it("rejects unsupported extensions", () => {
    const result = validateUploadClient(fakeFile({ name: "doc.pdf", type: "application/pdf" }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain(".pdf");
  });

  it("rejects files with no extension", () => {
    const result = validateUploadClient(fakeFile({ name: "README", type: "" }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("unknown");
  });

  it("rejects wrong MIME type when present", () => {
    const result = validateUploadClient(fakeFile({ name: "novel.txt", type: "application/pdf" }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("application/pdf");
  });

  it("allows empty MIME type (some browsers do this)", () => {
    const result = validateUploadClient(fakeFile({ name: "novel.txt", type: "" }));
    expect(result.valid).toBe(true);
  });

  it("rejects files over 50 MB", () => {
    const result = validateUploadClient(fakeFile({ size: 51 * 1024 * 1024 }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too large");
  });

  it("accepts files exactly at 50 MB", () => {
    const result = validateUploadClient(fakeFile({ size: 50 * 1024 * 1024 }));
    expect(result.valid).toBe(true);
  });

  it("rejects empty files (0 bytes)", () => {
    const result = validateUploadClient(fakeFile({ size: 0 }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("handles uppercase extensions correctly", () => {
    const result = validateUploadClient(fakeFile({ name: "BOOK.EPUB", type: "application/epub+zip" }));
    expect(result.valid).toBe(true);
  });

  it("rejects .txt.exe double extension tricks", () => {
    const result = validateUploadClient(fakeFile({ name: "novel.txt.exe", type: "" }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain(".exe");
  });
});
