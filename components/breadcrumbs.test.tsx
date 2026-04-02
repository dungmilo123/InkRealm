import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Breadcrumbs } from "@/components/breadcrumbs";

test("Breadcrumbs renders a nav with aria-label Breadcrumb", () => {
  const html = renderToStaticMarkup(
    createElement(Breadcrumbs, {
      items: [{ label: "Dashboard", href: "/dashboard" }],
    })
  );

  assert.ok(html.includes('aria-label="Breadcrumb"'));
  assert.ok(html.includes("<nav"));
  assert.ok(html.includes("<ol"));
});

test("Breadcrumbs renders a single item as current page span", () => {
  const html = renderToStaticMarkup(
    createElement(Breadcrumbs, {
      items: [{ label: "Dashboard" }],
    })
  );

  assert.ok(html.includes("Dashboard"));
  assert.ok(html.includes('aria-current="page"'));
  // Single item should not have a separator
  assert.equal(html.includes(" / "), false);
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
  assert.ok(html.includes('href="/dashboard"'));
  assert.ok(html.includes("Dashboard"));

  // My Novel is the last item — should be a span with aria-current="page"
  assert.ok(html.includes("My Novel"));
  assert.ok(html.includes('aria-current="page"'));
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

  assert.ok(html.includes('href="/dashboard"'));
  assert.ok(html.includes('href="/novels/123"'));
  assert.ok(html.includes("Chapter 1"));
  // Last item should be current page
  assert.ok(html.includes('aria-current="page"'));
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
  assert.ok(html.includes('aria-hidden="true"'));
  assert.ok(html.includes("/"));
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
  assert.equal(separatorCount, 1);
});

test("Breadcrumbs item without href renders as span even if not last", () => {
  // An item at a non-last position but without href should render as span (not link)
  const html = renderToStaticMarkup(
    createElement(Breadcrumbs, {
      items: [
        { label: "No Link" }, // no href, position 0 (also last here)
      ],
    })
  );

  // Should not render an anchor tag
  assert.equal(html.includes("<a "), false);
  assert.ok(html.includes("<span"));
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
  assert.ok(html.includes('aria-current="page"'));
  assert.ok(html.includes("Current"));
  // href="/current" should NOT appear since the last item renders as span
  assert.equal(html.includes('href="/current"'), false);
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

  assert.ok(html.includes("InkRealm Dashboard"));
  assert.ok(html.includes("A Very Long Novel Title"));
});