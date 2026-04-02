import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LibraryShelf } from "@/components/library-shelf";

function renderShelf(props: Parameters<typeof LibraryShelf>[0]) {
  return renderToStaticMarkup(createElement(LibraryShelf, props));
}

test("LibraryShelf renders children inside main#main", () => {
  const html = renderShelf({ children: createElement("p", null, "Hello shelf") });

  assert.ok(html.includes("Hello shelf"));
  assert.ok(html.includes('id="main"'));
  assert.ok(html.includes("<main"));
});

test("LibraryShelf without showBack renders InkRealm logo link to dashboard", () => {
  const html = renderShelf({ children: null });

  assert.ok(html.includes("InkRealm"));
  assert.ok(html.includes('href="/dashboard"'));
});

test("LibraryShelf with showBack renders back link to default /dashboard", () => {
  const html = renderShelf({ children: null, showBack: true });

  assert.ok(html.includes("InkRealm"));
  // Back link should point to default backHref "/dashboard"
  assert.ok(html.includes('href="/dashboard"'));
});

test("LibraryShelf with showBack and custom backHref renders correct back link", () => {
  const html = renderShelf({
    children: null,
    showBack: true,
    backHref: "/novels/123",
  });

  assert.ok(html.includes('href="/novels/123"'));
});

test("LibraryShelf without activeRoute does not render main navigation", () => {
  const html = renderShelf({ children: null });

  // Without activeRoute, the nav with Library/Settings links should not appear
  assert.equal(html.includes('aria-label="Main navigation"'), false);
});

test("LibraryShelf with activeRoute=dashboard renders main navigation", () => {
  const html = renderShelf({ children: null, activeRoute: "dashboard" });

  assert.ok(html.includes('aria-label="Main navigation"'));
  assert.ok(html.includes('href="/dashboard"'));
  assert.ok(html.includes('href="/settings"'));
  assert.ok(html.includes("Library"));
  assert.ok(html.includes("Settings"));
});

test("LibraryShelf with activeRoute=dashboard marks Library as current page", () => {
  const html = renderShelf({ children: null, activeRoute: "dashboard" });

  // Library link should have aria-current="page"
  assert.ok(html.includes('aria-current="page"'));
  // The Library link text should be near aria-current
  assert.ok(html.includes("Library"));
});

test("LibraryShelf with activeRoute=settings marks Settings as current page", () => {
  const html = renderShelf({ children: null, activeRoute: "settings" });

  assert.ok(html.includes('aria-label="Main navigation"'));
  assert.ok(html.includes('aria-current="page"'));
  assert.ok(html.includes("Settings"));
});

test("LibraryShelf without user renders My Library link", () => {
  const html = renderShelf({ children: null });

  assert.ok(html.includes("My Library"));
  // Should link to /dashboard
  assert.ok(html.includes('href="/dashboard"'));
});

test("LibraryShelf with showBack does not render main nav even with activeRoute", () => {
  // When showBack is true, the logo area shows a back arrow, not the full nav
  const html = renderShelf({
    children: null,
    showBack: true,
    activeRoute: "dashboard",
  });

  // showBack takes precedence - InkRealm should appear as a back link, not as nav
  // The Main navigation should NOT appear because showBack renders a different branch
  assert.equal(html.includes('aria-label="Main navigation"'), false);
});