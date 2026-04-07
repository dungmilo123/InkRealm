import { formatFileSize } from "@/app/lib/format";

test("formatFileSize formats bytes under 1024 as B", () => {
  expect(formatFileSize(0)).toBe("0 B");
  expect(formatFileSize(1)).toBe("1 B");
  expect(formatFileSize(512)).toBe("512 B");
  expect(formatFileSize(1023)).toBe("1023 B");
});

test("formatFileSize formats bytes at exactly 1024 as KB", () => {
  expect(formatFileSize(1024)).toBe("1.0 KB");
});

test("formatFileSize formats kilobyte range values", () => {
  expect(formatFileSize(2048)).toBe("2.0 KB");
  expect(formatFileSize(1536)).toBe("1.5 KB");
  expect(formatFileSize(1024 * 1024 - 1)).toBe("1024.0 KB");
});

test("formatFileSize formats bytes at exactly 1 MB", () => {
  expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
});

test("formatFileSize formats megabyte range values", () => {
  expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
  expect(formatFileSize(10 * 1024 * 1024)).toBe("10.0 MB");
});

test("formatFileSize rounds to one decimal place in KB range", () => {
  // 1100 bytes = 1100/1024 ≈ 1.074... KB → rounds to 1.1 KB
  expect(formatFileSize(1100)).toBe("1.1 KB");
  // 1536 bytes = 1.5 KB exactly
  expect(formatFileSize(1536)).toBe("1.5 KB");
});

test("formatFileSize rounds to one decimal place in MB range", () => {
  // 3145728 bytes = 3.0 MB (as documented in JSDoc)
  expect(formatFileSize(3145728)).toBe("3.0 MB");
  // 1572864 bytes = 1.5 MB
  expect(formatFileSize(1572864)).toBe("1.5 MB");
});

test("formatFileSize boundary: 1023 bytes stays as B not KB", () => {
  expect(formatFileSize(1023)).toBe("1023 B");
  expect(formatFileSize(1023)).not.toBe("1023 KB");
});

test("formatFileSize boundary: 1024*1024-1 stays as KB not MB", () => {
  const result = formatFileSize(1024 * 1024 - 1);
  expect(result.endsWith(" KB")).toBeTruthy();
});