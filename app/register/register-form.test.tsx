import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RegisterForm } from "@/app/register/register-form";

test("RegisterForm renders the Create account heading", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  expect(html).toContain("Create account");
});

test("RegisterForm renders email input field", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  expect(html).toContain('id="email"');
  expect(html).toContain('type="email"');
  expect(html).toContain("Email");
});

test("RegisterForm renders password input field with PasswordInput component", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  expect(html).toContain('id="password"');
  // PasswordInput renders type=password initially
  expect(html).toContain('type="password"');
  expect(html).toContain("Password");
});

test("RegisterForm renders confirm password input field", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  expect(html).toContain('id="confirmPassword"');
  expect(html).toContain("Confirm password");
});

test("RegisterForm renders submit button with Create account text", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  expect(html).toContain("Create account");
  // The button should be of type submit
  expect(html).toContain('type="submit"');
});

test("RegisterForm renders sign in link to /login", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  expect(html).toContain('href="/login"');
  expect(html).toContain("Sign in");
  expect(html).toContain("Already have an account?");
});

test("RegisterForm renders PasswordInput toggle buttons for password fields", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  // Each PasswordInput renders a show/hide button
  const showPasswordCount = (html.match(/aria-label="Show password"/g) ?? []).length;
  expect(showPasswordCount).toBe(2, "Should have two Show password toggle buttons");
});

test("RegisterForm password inputs have autocomplete attributes", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  expect(html).toContain('autoComplete="new-password"');
  expect(html).toContain('autoComplete="email"');
});

test("RegisterForm password inputs have required and minLength constraints", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  // Both password PasswordInputs should have minLength=8
  const minLengthCount = (html.match(/minLength="8"/g) ?? []).length;
  expect(minLengthCount).toBe(2, "Both password fields should have minLength=8");
});

test("RegisterForm sign up description text is present", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  expect(html).toContain("Sign up to start building your novel library");
});

test("RegisterForm email input has email autocomplete", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  expect(html).toContain('autoComplete="email"');
});

test("RegisterForm does not show error message in initial state", () => {
  const html = renderToStaticMarkup(createElement(RegisterForm));

  // Error div has specific classes - should not be in initial render
  expect(html.includes("bg-destructive/10")).toBe(false);
  expect(html.includes("text-destructive")).toBe(false);
});