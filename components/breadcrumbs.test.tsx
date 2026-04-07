import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Breadcrumbs } from "@/components/breadcrumbs";

test("Breadcrumbs renders a nav with aria-label Breadcrumb", () => {
  const html = renderToStaticMarkup(
    createElement(Breadcrumbs, {
      items: [{ label: "Dashboard", href: "/dashboard" }],
    })
  );

  expect(html).toContain('aria-label="Breadcrumb"');
  expect(html).toContain("<nav");
  expect(html).toContain("<ol");
});

test("Breadcrumbs renders a single item as current page span", () => {
  const html = renderToStaticMarkup(
    createElement(Breadcrumbs, {
      items: [{ label: "Dashboard" }],
    })
  );

  expect(html).toContain("Dashboard");
  expect(html).toContain('aria-current="page"');
  // Single item should not have a separator
  expect(html.includes(" / ")).toBe(false);
});

test("Breadcrumbs renders intermediate items as links", () => {
  const html = renderToStaticMarkup(
    createElement(Breadcrumbs, {
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "My Novel" },
      ],
    })
  );

  // Dashboard should be a link
  expect(html).toContain('href="/dashboard"');
  expect(html).toContain("Dashboard");

  // My Novel is the last item — should be a span with aria-current="page"
  expect(html).toContain("My Novel");
  expect(html).toContain('aria-current="page"');
});

test("Breadcrumbs renders three-level breadcrumb correctly", () => {
  const html = renderToStaticMarkup(
    createElement(Breadcrumbs, {
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "My Novel", href: "/novels/123" },
        { label: "Chapter 1" },
      ],
    })
  );

  expect(html).toContain('href="/dashboard"');
  expect(html).toContain('href="/novels/123"');
  expect(html).toContain("Chapter 1");
  // Last item should be current page
  expect(html).toContain('aria-current="page"');
});

test("Breadcrumbs renders separator / between items", () => {
  const html = renderToStaticMarkup(
    createElement(Breadcrumbs, {
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Novel" },
      ],
    })
  );

  // Separator / should be present with aria-hidden
  expect(html).toContain('aria-hidden="true"');
  expect(html).toMatch(/aria-hidden="true"[^>]*>\s*\/\s*</);
});

test("Breadcrumbs does not render separator before first item", () => {
  const html = renderToStaticMarkup(
    createElement(Breadcrumbs, {
      items: [
        { label: "Home", href: "/" },
        { label: "Page" },
      ],
    })
  );

  // Should only have one separator (between items), not before first
  const separatorCount = (html.match(/aria-hidden="true"/g) ?? []).length;
  expect(separatorCount).toBe(1);
});

test("Breadcrumbs item without href renders as span when not last", () => {
  const html = renderToStaticMarkup(
    createElement(Breadcrumbs, {
      items: [
        { label: "No Link" }, // non-last, no href
        { label: "Linked", href: "/linked" },
        { label: "Current" },
      ],
    })
  );

  expect(html).toMatch(/<span[^>]*>No Link<\/span>/);
  expect(html).toMatch(/<a[^>]*href="\/linked"[^>]*>Linked<\/a>/);
});

test("Breadcrumbs last item with href renders as span (not link)", () => {
  // Even if last item has href, it should render as span (isLast takes precedence)
  const html = renderToStaticMarkup(
    createElement(Breadcrumbs, {
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Current", href: "/current" },
      ],
    })
  );

  // The last item "Current" should be a span with aria-current, not a link
  expect(html).toContain('aria-current="page"');
  expect(html).toContain("Current");
  // href="/current" should NOT appear since the last item renders as span
  expect(html.includes('href="/current"')).toBe(false);
});

test("Breadcrumbs renders labels correctly", () => {
  const html = renderToStaticMarkup(
    createElement(Breadcrumbs, {
      items: [
        { label: "InkRealm Dashboard", href: "/dashboard" },
        { label: "A Very Long Novel Title" },
      ],
    })
  );

  expect(html).toContain("InkRealm Dashboard");
  expect(html).toContain("A Very Long Novel Title");
});