import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LibraryShelf } from "@/components/library-shelf";

function renderShelf(props: Parameters<typeof LibraryShelf>[0]) {
  return renderToStaticMarkup(createElement(LibraryShelf, props));
}

test("LibraryShelf renders children inside main#main", () => {
  const html = renderShelf({ children: createElement("p", null, "Hello shelf") });

  expect(html).toContain("Hello shelf");
  expect(html).toContain('id="main"');
  expect(html).toContain("<main");
});

test("LibraryShelf without showBack renders InkRealm logo link to dashboard", () => {
  const html = renderShelf({ children: null });

  expect(html).toContain("InkRealm");
  expect(html).toContain('href="/dashboard"');
});

test("LibraryShelf with showBack renders back link to default /dashboard", () => {
  const html = renderShelf({ children: null, showBack: true });

  expect(html).toContain("InkRealm");
  // Back link should point to default backHref "/dashboard"
  expect(html).toContain('href="/dashboard"');
});

test("LibraryShelf with showBack and custom backHref renders correct back link", () => {
  const html = renderShelf({
    children: null,
    showBack: true,
    backHref: "/novels/123",
  });

  expect(html).toContain('href="/novels/123"');
});

test("LibraryShelf without activeRoute does not render main navigation", () => {
  const html = renderShelf({ children: null });

  // Without activeRoute, the nav with Library/Settings links should not appear
  expect(html.includes('aria-label="Main navigation"')).toBe(false);
});

test("LibraryShelf with activeRoute=dashboard renders main navigation", () => {
  const html = renderShelf({ children: null, activeRoute: "dashboard" });

  expect(html).toContain('aria-label="Main navigation"');
  expect(html).toContain('href="/dashboard"');
  expect(html).toContain('href="/settings"');
  expect(html).toContain("Library");
  expect(html).toContain("Settings");
});

test("LibraryShelf with activeRoute=dashboard marks Library as current page", () => {
  const html = renderShelf({ children: null, activeRoute: "dashboard" });

  // Library link should have aria-current="page"
  expect(html).toContain('aria-current="page"');
  // The Library link text should be near aria-current
  expect(html).toContain("Library");
});

test("LibraryShelf with activeRoute=settings marks Settings as current page", () => {
  const html = renderShelf({ children: null, activeRoute: "settings" });

  expect(html).toContain('aria-label="Main navigation"');
  expect(html).toContain('aria-current="page"');
  expect(html).toContain("Settings");
});

test("LibraryShelf without user renders My Library link", () => {
  const html = renderShelf({ children: null });

  expect(html).toContain("My Library");
  // Should link to /dashboard
  expect(html).toContain('href="/dashboard"');
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
  expect(html.includes('aria-label="Main navigation"')).toBe(false);
});