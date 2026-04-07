import { readJsonOrError } from "./fetch";

describe("readJsonOrError", () => {
  test("returns parsed JSON for successful responses", async () => {
    const body = { id: 1, name: "Test" };
    const response = new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    const result = await readJsonOrError<{ id: number; name: string }>(response);
    expect(result).toEqual({ id: 1, name: "Test" });
  });

  test("returns full payload including extra fields", async () => {
    const body = { data: [1, 2, 3], meta: { total: 3 } };
    const response = new Response(JSON.stringify(body), { status: 200 });

    const result = await readJsonOrError<{ data: number[]; meta: { total: number } }>(response);
    expect(result).toEqual(body);
  });

  test("throws with server error message on 400 response", async () => {
    const body = { error: "Email is required" };
    const response = new Response(JSON.stringify(body), { status: 400 });

    await expect(
      () => readJsonOrError(response)
    ).rejects.toThrow("Email is required");
  });

  test("throws with server error message on 401 response", async () => {
    const body = { error: "Unauthorized" };
    const response = new Response(JSON.stringify(body), { status: 401 });

    await expect(
      () => readJsonOrError(response)
    ).rejects.toThrow("Unauthorized");
  });

  test("throws with server error message on 500 response", async () => {
    const body = { error: "Internal server error" };
    const response = new Response(JSON.stringify(body), { status: 500 });

    await expect(
      () => readJsonOrError(response)
    ).rejects.toThrow("Internal server error");
  });

  test("throws 'Request failed' when error response has no error field", async () => {
    const body = { success: false };
    const response = new Response(JSON.stringify(body), { status: 422 });

    await expect(
      () => readJsonOrError(response)
    ).rejects.toThrow("Request failed");
  });

  test("throws 'Request failed' when error field is empty string", async () => {
    const body = { error: "" };
    const response = new Response(JSON.stringify(body), { status: 400 });

    // Empty string is falsy, so || falls through to "Request failed"
    await expect(
      () => readJsonOrError(response)
    ).rejects.toThrow("Request failed");
  });

  test("does not throw for 2xx statuses with error-shaped body", async () => {
    // A successful response that happens to have an error field should still succeed
    const body = { error: "not a real error", data: "ok" };
    const response = new Response(JSON.stringify(body), { status: 200 });

    const result = await readJsonOrError<{ error: string; data: string }>(response);
    expect(result.data).toBe("ok");
    expect(result.error).toBe("not a real error");
  });

  test("handles 201 Created response with JSON body", async () => {
    const body = { id: 42 };
    const response = new Response(JSON.stringify(body), { status: 201 });

    const result = await readJsonOrError<{ id: number }>(response);
    expect(result.id).toBe(42);
  });
});
