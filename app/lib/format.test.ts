import assert from "node:assert/strict";
import test from "node:test";
import { formatFileSize } from "@/app/lib/format";

test("formatFileSize formats bytes under 1024 as B", () => {
  assert.equal(formatFileSize(0), "0 B");
  assert.equal(formatFileSize(1), "1 B");
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(1023), "1023 B");
});

test("formatFileSize formats bytes at exactly 1024 as KB", () => {
  assert.equal(formatFileSize(1024), "1.0 KB");
});

test("formatFileSize formats kilobyte range values", () => {
  assert.equal(formatFileSize(2048), "2.0 KB");
  assert.equal(formatFileSize(1536), "1.5 KB");
  assert.equal(formatFileSize(1024 * 1024 - 1), "1024.0 KB");
});

test("formatFileSize formats bytes at exactly 1 MB", () => {
  assert.equal(formatFileSize(1024 * 1024), "1.0 MB");
});

test("formatFileSize formats megabyte range values", () => {
  assert.equal(formatFileSize(2 * 1024 * 1024), "2.0 MB");
  assert.equal(formatFileSize(1.5 * 1024 * 1024), "1.5 MB");
  assert.equal(formatFileSize(10 * 1024 * 1024), "10.0 MB");
});

test("formatFileSize rounds to one decimal place in KB range", () => {
  // 1100 bytes = 1100/1024 ≈ 1.074... KB → rounds to 1.1 KB
  assert.equal(formatFileSize(1100), "1.1 KB");
  // 1536 bytes = 1.5 KB exactly
  assert.equal(formatFileSize(1536), "1.5 KB");
});

test("formatFileSize rounds to one decimal place in MB range", () => {
  // 3145728 bytes = 3.0 MB (as documented in JSDoc)
  assert.equal(formatFileSize(3145728), "3.0 MB");
  // 1572864 bytes = 1.5 MB
  assert.equal(formatFileSize(1572864), "1.5 MB");
});

test("formatFileSize boundary: 1023 bytes stays as B not KB", () => {
  assert.equal(formatFileSize(1023), "1023 B");
  assert.notEqual(formatFileSize(1023), "1023 KB");
});

test("formatFileSize boundary: 1024*1024-1 stays as KB not MB", () => {
  const result = formatFileSize(1024 * 1024 - 1);
  assert.ok(result.endsWith(" KB"), `Expected KB suffix, got: ${result}`);
});