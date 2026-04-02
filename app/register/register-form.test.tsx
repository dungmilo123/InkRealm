import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RegisterForm } from "@/app/register/register-form";

test("RegisterForm renders the Create account heading", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  assert.ok(html.includes("Create account"));
});

test("RegisterForm renders email input field", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  assert.ok(html.includes('id="email"'));
  assert.ok(html.includes('type="email"'));
  assert.ok(html.includes("Email"));
});

test("RegisterForm renders password input field with PasswordInput component", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  assert.ok(html.includes('id="password"'));
  // PasswordInput renders type=password initially
  assert.ok(html.includes('type="password"'));
  assert.ok(html.includes("Password"));
});

test("RegisterForm renders confirm password input field", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  assert.ok(html.includes('id="confirmPassword"'));
  assert.ok(html.includes("Confirm password"));
});

test("RegisterForm renders submit button with Create account text", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  assert.ok(html.includes("Create account"));
  // The button should be of type submit
  assert.ok(html.includes('type="submit"'));
});

test("RegisterForm renders sign in link to /login", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  assert.ok(html.includes('href="/login"'));
  assert.ok(html.includes("Sign in"));
  assert.ok(html.includes("Already have an account?"));
});

test("RegisterForm renders PasswordInput toggle buttons for password fields", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  // Each PasswordInput renders a show/hide button
  const showPasswordCount = (html.match(/aria-label="Show password"/g) ?? []).length;
  assert.equal(showPasswordCount, 2, "Should have two Show password toggle buttons");
});

test("RegisterForm password inputs have autocomplete attributes", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  assert.ok(html.includes('autoComplete="new-password"'));
  assert.ok(html.includes('autoComplete="email"'));
});

test("RegisterForm password inputs have required and minLength constraints", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  // Both password PasswordInputs should have minLength=8
  const minLengthCount = (html.match(/minLength="8"/g) ?? []).length;
  assert.equal(minLengthCount, 2, "Both password fields should have minLength=8");
});

test("RegisterForm sign up description text is present", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  assert.ok(html.includes("Sign up to start building your novel library"));
});

test("RegisterForm email input has email autocomplete", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  assert.ok(html.includes('autoComplete="email"'));
});

test("RegisterForm does not show error message in initial state", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  // Error div has specific classes - should not be in initial render
  assert.equal(html.includes("bg-destructive/10"), false);
  assert.equal(html.includes("text-destructive"), false);
});