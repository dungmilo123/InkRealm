import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PasswordInput } from "@/components/ui/password-input";

test("PasswordInput renders an input element", () => {
  const html = renderToStaticMarkup(createElement(PasswordInput, {}));

  assert.ok(html.includes("<input"));
});

test("PasswordInput renders with type=password by default", () => {
  const html = renderToStaticMarkup(createElement(PasswordInput, {}));

  assert.ok(html.includes('type="password"'));
});

test("PasswordInput renders a toggle button", () => {
  const html = renderToStaticMarkup(createElement(PasswordInput, {}));

  assert.ok(html.includes("<button"));
  assert.ok(html.includes('type="button"'));
});

test("PasswordInput toggle button has aria-label Show password initially", () => {
  const html = renderToStaticMarkup(createElement(PasswordInput, {}));

  assert.ok(html.includes('aria-label="Show password"'));
});

test("PasswordInput toggle button has eye icon SVG when password is hidden", () => {
  const html = renderToStaticMarkup(createElement(PasswordInput, {}));

  // The eye icon (password visible) SVG has a circle element
  assert.ok(html.includes("<circle"));
  // Eye SVG path for the iris
  assert.ok(html.includes('r="3"'));
});

test("PasswordInput accepts and passes through id prop", () => {
  const html = renderToStaticMarkup(
    createElement(PasswordInput, { id: "my-password-field" })
  );

  assert.ok(html.includes('id="my-password-field"'));
});

test("PasswordInput accepts and passes through placeholder prop", () => {
  const html = renderToStaticMarkup(
    createElement(PasswordInput, { placeholder: "Enter your secret" })
  );

  assert.ok(html.includes('placeholder="Enter your secret"'));
});

test("PasswordInput wraps input in a relative div container", () => {
  const html = renderToStaticMarkup(createElement(PasswordInput, {}));

  assert.ok(html.includes("<div"));
  // The container should have relative positioning class
  assert.ok(html.includes("relative"));
});

test("PasswordInput passes through className to input (combined with pr-10)", () => {
  const html = renderToStaticMarkup(
    createElement(PasswordInput, { className: "my-custom-class" })
  );

  assert.ok(html.includes("my-custom-class"));
  // Should also include the built-in pr-10 padding-right for the toggle button
  assert.ok(html.includes("pr-10"));
});

test("PasswordInput passes through required and autoComplete props", () => {
  const html = renderToStaticMarkup(
    createElement(PasswordInput, {
      required: true,
      autoComplete: "new-password",
    })
  );

  // React renders boolean required as required=""
  assert.ok(html.includes('required=""'));
  assert.ok(html.includes('autoComplete="new-password"'));
});

test("PasswordInput passes through minLength prop", () => {
  const html = renderToStaticMarkup(
    createElement(PasswordInput, { minLength: 8 })
  );

  assert.ok(html.includes('minLength="8"'));
});

test("PasswordInput toggle button SVG icon has aria-hidden=true", () => {
  const html = renderToStaticMarkup(createElement(PasswordInput, {}));

  assert.ok(html.includes('aria-hidden="true"'));
});