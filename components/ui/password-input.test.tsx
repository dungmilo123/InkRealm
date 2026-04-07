import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PasswordInput } from "@/components/ui/password-input";

test("PasswordInput renders an input element", () => {
  const html = renderToStaticMarkup(createElement(PasswordInput, {}));

  expect(html).toContain("<input");
});

test("PasswordInput renders with type=password by default", () => {
  const html = renderToStaticMarkup(createElement(PasswordInput, {}));

  expect(html).toContain('type="password"');
});

test("PasswordInput renders a toggle button", () => {
  const html = renderToStaticMarkup(createElement(PasswordInput, {}));

  expect(html).toContain("<button");
  expect(html).toContain('type="button"');
});

test("PasswordInput toggle button has aria-label Show password initially", () => {
  const html = renderToStaticMarkup(createElement(PasswordInput, {}));

  expect(html).toContain('aria-label="Show password"');
});

test("PasswordInput toggle button has eye icon SVG when password is hidden", () => {
  const html = renderToStaticMarkup(createElement(PasswordInput, {}));

  // The eye icon (password visible) SVG has a circle element
  expect(html).toContain("<circle");
  // Eye SVG path for the iris
  expect(html).toContain('r="3"');
});

test("PasswordInput accepts and passes through id prop", () => {
  const html = renderToStaticMarkup(
    createElement(PasswordInput, { id: "my-password-field" })
  );

  expect(html).toContain('id="my-password-field"');
});

test("PasswordInput accepts and passes through placeholder prop", () => {
  const html = renderToStaticMarkup(
    createElement(PasswordInput, { placeholder: "Enter your secret" })
  );

  expect(html).toContain('placeholder="Enter your secret"');
});

test("PasswordInput wraps input in a relative div container", () => {
  const html = renderToStaticMarkup(createElement(PasswordInput, {}));

  expect(html).toContain("<div");
  // The container should have relative positioning class
  expect(html).toContain("relative");
});

test("PasswordInput passes through className to input (combined with pr-10)", () => {
  const html = renderToStaticMarkup(
    createElement(PasswordInput, { className: "my-custom-class" })
  );

  expect(html).toContain("my-custom-class");
  // Should also include the built-in pr-10 padding-right for the toggle button
  expect(html).toContain("pr-10");
});

test("PasswordInput passes through required and autoComplete props", () => {
  const html = renderToStaticMarkup(
    createElement(PasswordInput, {
      required: true,
      autoComplete: "new-password",
    })
  );

  // React renders boolean required as required=""
  expect(html).toContain('required=""');
  expect(html).toContain('autoComplete="new-password"');
});

test("PasswordInput passes through minLength prop", () => {
  const html = renderToStaticMarkup(
    createElement(PasswordInput, { minLength: 8 })
  );

  expect(html).toContain('minLength="8"');
});

test("PasswordInput toggle button SVG icon has aria-hidden=true", () => {
  const html = renderToStaticMarkup(createElement(PasswordInput, {}));

  expect(html).toContain('aria-hidden="true"');
});