# InkRealm UI/UX Audit

**Date:** 2026-04-02
**Tool:** UI/UX Pro Max Design Intelligence
**Stack:** Next.js 16, React 19, Tailwind CSS v4, shadcn/ui (base-nova), OKLCH color system

---

## Severity Legend

| Severity | Meaning |
|----------|---------|
| 🔴 **CRITICAL** | Accessibility violation or broken interaction — fix first |
| 🟠 **HIGH** | Significantly degrades UX or professional quality |
| 🟡 **MEDIUM** | Noticeable polish gap, affects perceived quality |
| 🟢 **LOW** | Enhancement opportunity, not a defect |

---

## 1. Accessibility & Interaction (Priority 1–2)

| # | Severity | Area | Issue | Where | Recommendation |
|---|----------|------|-------|-------|----------------|
| 1 | 🔴 | A11y | **No skip-to-main-content link** — keyboard users must tab through header/nav on every page | `layout.tsx`, `library-shelf.tsx` | Add a visually hidden skip link as the first focusable element: `<a href="#main" class="sr-only focus:not-sr-only">Skip to content</a>` and `id="main"` on `<main>` |
| 2 | 🔴 | A11y | **`prefers-reduced-motion` not respected** — hover scale animations on novel cards and progress bar transitions play regardless | `NovelList.tsx` (line 32), `details-tabs.tsx` (line 149) | Wrap animations with `motion-safe:` prefix: `motion-safe:group-hover:scale-[1.02]`. Add `@media (prefers-reduced-motion: reduce)` override in `globals.css` |
| 3 | 🔴 | A11y | **Password fields lack show/hide toggle** — users can't verify input, especially on mobile | `login-form.tsx`, `settings-client.tsx` | Add an eye/eye-off toggle button with `aria-label="Show password"` next to each password input |
| 4 | 🟠 | A11y | **Range sliders in reader have no ARIA labels** — screen readers announce raw values without context | `reader-client.tsx` (lines 42-80) | Add `aria-label="Font size"`, `aria-valuetext="18 pixels"` etc. to each `<input type="range">` |
| 5 | 🟠 | A11y | **Upload form missing `aria-live` region** — success/error messages after upload aren't announced to screen readers | `UploadForm.tsx` (line 69-79) | Wrap the message `<div>` with `aria-live="polite"` and `role="status"` |
| 6 | 🟠 | Touch | **File input touch target is browser-default** — may be too small on mobile devices | `UploadForm.tsx` (line 54-59) | Wrap in a styled label/button with min `h-11` to meet 44px touch target requirement |
| 7 | 🟡 | A11y | **Tabs lack `role="tablist"`, `role="tab"`, `role="tabpanel"` in custom DetailsTabs** — relies on visual style only | `details-tabs.tsx` (lines 164-179) | Add proper ARIA tab pattern: `role="tablist"` on container, `role="tab"` + `aria-selected` on buttons, `role="tabpanel"` on content |
| 8 | 🟡 | A11y | **Color-only indicators for chapter status** — ◉ (primary), ✓ (green), ○ (muted) convey meaning by color alone | `details-tabs.tsx` (lines 56-67) | The Unicode chars help, but add `aria-label` to each: `aria-label="Current chapter"`, `aria-label="Visited"`, `aria-label="Not visited"` |

---

## 2. Navigation & Wayfinding (Priority 9)

| # | Severity | Area | Issue | Where | Recommendation |
|---|----------|------|-------|-------|----------------|
| 9 | 🟠 | Nav | **No breadcrumb navigation** — novel details and reader pages are 3+ levels deep with no orientation cues | `novel-details-view.tsx`, `reader-client.tsx` | Add breadcrumbs: `Dashboard → Novel Title → Chapter X`. Use `<nav aria-label="Breadcrumb">` with `<ol>` |
| 10 | 🟠 | Nav | **UserMenu is flat links, not a dropdown** — "Settings" and "Sign out" are equally weighted, and the destructive action (sign out) is not visually separated | `user-menu.tsx` | Refactor into a popover/dropdown menu. Visually separate "Sign out" with a divider and `text-destructive` color |
| 11 | 🟠 | Nav | **Settings page has no header/shell** — uses plain back link instead of LibraryShelf, inconsistent with all other pages | `settings-client.tsx` | Wrap in `<LibraryShelf showBack>` for consistent navigation chrome |
| 12 | 🟡 | Nav | **No active state in navigation** — header shows no indication of which section you're on (Dashboard vs Settings) | `library-shelf.tsx` | Add an active indicator (underline or bold) for the current route |
| 13 | 🟡 | Nav | **Reader header nav order is reversed** — "Novel details" appears before "InkRealm", breaking left-to-right hierarchy (general → specific) | `reader-client.tsx` (lines 214-226) | Swap order: `InkRealm → Novel Title → Chapter X` (breadcrumb pattern, general to specific) |

---

## 3. Feedback & States (Priority 8)

| # | Severity | Area | Issue | Where | Recommendation |
|---|----------|------|-------|-------|----------------|
| 14 | 🟠 | Feedback | **No toast/notification system** — success/error messages are inline and easily missed, especially after upload or settings changes | Global | Add a toast system (e.g., `sonner` or shadcn/ui toast). Use for: upload success, password changed, translation started, provider saved |
| 15 | 🟠 | Feedback | **No skeleton loading states** — server-rendered pages show nothing during navigation transitions (especially novel details which fetches 3+ parallel queries) | `dashboard/page.tsx`, `novels/[novelId]/page.tsx` | Add `loading.tsx` files with skeleton placeholders for each route. Use `animate-pulse` placeholders matching content shape |
| 16 | 🟠 | Feedback | **Upload has no progress indicator** — large EPUB files may take seconds, but the button only shows "Uploading..." text | `UploadForm.tsx` | Add a progress bar or spinner. Consider `XMLHttpRequest` with `onprogress` for real upload progress, or at minimum a spinning icon |
| 17 | 🟡 | Feedback | **Success state uses generic muted style** — password change success looks identical to informational messages | `settings-client.tsx` (line 215-216) | Use a distinct success style: `bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:text-green-300` (matching the pattern in `UploadForm.tsx`) |
| 18 | 🟡 | Feedback | **No required field indicators** on login/register forms | `login-form.tsx` | Add `*` or "(required)" to labels for required fields |
| 19 | 🟡 | Feedback | **Settings popover (reader) has no Escape key handler** — only closes on outside click, not keyboard dismissal | `reader-client.tsx` (lines 187-197) | Add `useEffect` listener for `keydown` → `Escape` to close the popover |

---

## 4. Layout & Responsive Design (Priority 5)

| # | Severity | Area | Issue | Where | Recommendation |
|---|----------|------|-------|-------|----------------|
| 20 | 🟠 | Layout | **Landing page is barren** — single card with no visual richness, hero imagery, or brand storytelling for a "dark fantasy" literary product | `app/page.tsx` | Add atmospheric elements: subtle background texture/gradient, a tagline about the translation feature, feature highlights, or an illustration. Consider the E-Ink/Paper style for reading focus |
| 21 | 🟡 | Layout | **Max content width inconsistent** — LibraryShelf uses `max-w-5xl` (1024px), Reader uses `max-w-4xl` (896px), Settings uses `max-w-2xl` (672px) | Multiple | Standardize: use `max-w-5xl` for all shell pages, reader content width is fine (user-controlled via prefs) |
| 22 | 🟡 | Layout | **Book cover overflow on mobile** — 140×210px cover is fixed width on novel details, may not center well on very small screens | `novel-details-view.tsx` (line 96-103) | Add `mx-auto sm:mx-0` to center the cover on mobile when the layout stacks vertically |
| 23 | 🟡 | Layout | **Upload section has double card border** — UploadForm renders its own `border border-border bg-card` inside another `bg-card rounded-lg border border-border` wrapper in the dashboard | `dashboard/page.tsx` (line 52) + `UploadForm.tsx` (line 51) | Remove the inner border from UploadForm (the dashboard already provides the card wrapper) |
| 24 | 🟢 | Layout | **Footer is minimal** — "Built for readers" is placeholder-quality for a product landing | `app/page.tsx` (line 24-28) | Add links (GitHub, terms, version), or remove footer if not needed |

---

## 5. Typography & Color (Priority 6)

| # | Severity | Area | Issue | Where | Recommendation |
|---|----------|------|-------|-------|----------------|
| 25 | 🟡 | Type | **`html lang="vi"` is set globally** — but the app UI is in English, only translation *output* is Vietnamese | `layout.tsx` (line 32) | Change to `lang="en"` — the interface language is English. Vietnamese content in the reader can use `<div lang="vi">` locally |
| 26 | 🟡 | Type | **No line-length control on reader** — content width is user-adjustable (500-1000px) but at 1000px with 16px font, lines can exceed 90 characters | `reader-client.tsx` | Add a `max-width: 75ch` soft cap on the paragraph container, or adjust the slider max to ~800px |
| 27 | 🟡 | Type | **Chapter list truncates titles without tooltip** — long chapter titles get `truncate` with no way to see full text | `details-tabs.tsx` (line 83) | Add `title={ch.title}` attribute for hover tooltip, or switch to multi-line wrap |
| 28 | 🟢 | Color | **Chart colors defined but unused** — 5 chart color tokens exist in `globals.css` but no charts exist in the app | `globals.css` (lines 70-74, 105-109) | Clean up unused tokens, or document them as reserved for future analytics |

---

## 6. Animation & Motion (Priority 7)

| # | Severity | Area | Issue | Where | Recommendation |
|---|----------|------|-------|-------|----------------|
| 29 | 🟡 | Motion | **No page transition animations** — navigating between pages is an instant hard cut with no visual continuity | Global | Add subtle crossfade using Next.js `loading.tsx` + CSS transitions, or use `next-view-transitions` for shared element animation between novel card → novel details |
| 30 | 🟡 | Motion | **Tab switching is instant** — no content transition when switching between Chapters/Translation/Glossary tabs | `details-tabs.tsx` | Add a subtle `animate-in fade-in` (from tw-animate-css) on tab panel entrance |
| 31 | 🟢 | Motion | **Novel card hover animation could use spring easing** — current `duration-200` with default easing feels mechanical | `NovelList.tsx` (line 32) | Consider `transition-all duration-300 ease-out` for a more natural deceleration |

---

## 7. Forms & Data Entry (Priority 8)

| # | Severity | Area | Issue | Where | Recommendation |
|---|----------|------|-------|-------|----------------|
| 32 | 🟡 | Forms | **No inline validation on login/register** — errors only appear after submit attempt | `login-form.tsx` | Add on-blur validation for email format and password length, showing inline helper text |
| 33 | 🟡 | Forms | **Translation chapter range inputs lack clear affordance** — they appear only after clicking "Advanced" text with no visual hint that advanced options exist | `translation-panel.tsx` (lines 292-309) | Add a subtle count indicator: `"Advanced: Set chapter range (1-{chapterCount})"` |
| 34 | 🟡 | Forms | **No confirmation before deleting a novel** — if this feature exists, ensure destructive action uses `AlertDialog` | Potential gap | Verify novel deletion flow has confirmation dialog |
| 35 | 🟢 | Forms | **Reader settings changes don't confirm** — font/theme/width adjustments silently auto-save (good!), but there's no visual confirmation the preference was persisted | `reader-client.tsx` | This is actually fine UX for settings — no change needed. The debounced save is elegant. Just ensure the API error case is handled (currently fire-and-forget) |

---

## 8. Performance & Technical (Priority 3)

| # | Severity | Area | Issue | Where | Recommendation |
|---|----------|------|-------|-------|----------------|
| 36 | 🟡 | Perf | **BookCover is rendered inline with no lazy loading** — all covers in the grid render immediately, including off-screen ones | `NovelList.tsx` | For grids with 20+ novels, consider virtualizing the list or lazy-loading covers below the fold |
| 37 | 🟡 | Perf | **Google SVG icon is duplicated** — the full Google logo SVG appears identically in both `login-form.tsx` and `settings-client.tsx` | Two files | Extract to a shared `GoogleIcon` component in `components/icons/` |
| 38 | 🟢 | Perf | **Reader preferences API has no error handling** — the debounced `fetch` to `/api/reading/preferences` silently swallows failures | `reader-client.tsx` (line 170-175) | Add a `.catch()` that shows a subtle toast: "Couldn't save preferences" |

---

## 9. Brand & Visual Identity

| # | Severity | Area | Issue | Where | Recommendation |
|---|----------|------|-------|-------|----------------|
| 39 | 🟡 | Brand | **No favicon or app icon** — browser tab shows default Next.js icon | Root | Add a custom favicon matching the InkRealm brand (quill, book, or monogram) |
| 40 | 🟡 | Brand | **ThemeToggle component exists but isn't used** — dark-first design has no way for users to switch to light mode from the main UI | `theme-toggle.tsx` | Either add ThemeToggle to the UserMenu/header, or remove the component if dark-only is intentional |
| 41 | 🟢 | Brand | **"Built for readers" footer is underwhelming** for a product named "InkRealm" — the dark fantasy brand promise isn't carried through the landing | `app/page.tsx` | Consider "Where stories transcend languages" or similar copy that hints at the translation feature |

---

## Summary by Severity

| Severity | Count | Priority Actions |
|----------|-------|-----------------|
| 🔴 CRITICAL | 3 | Skip link, reduced motion, password toggle |
| 🟠 HIGH | 10 | Toast system, skeleton loading, breadcrumbs, ARIA improvements |
| 🟡 MEDIUM | 22 | Polish: tab ARIA, nav consistency, inline validation, transitions |
| 🟢 LOW | 6 | Enhancements: footer, favicon, spring easing, unused tokens |

---

## What InkRealm Does Well

- **OKLCH color system** — perceptually uniform colors with proper dark/light token pairing is ahead of most apps
- **Cormorant Garamond + Crimson Pro** — excellent literary font pairing, well-chosen for a novel reader
- **Procedural BookCover generation** (8 palettes × 4 layouts, hash-based) — creative, eliminates the "no cover art" problem
- **Translation panel state machine** (idle → translating → completed → failed) with hanging detection — sophisticated UX
- **Reading preferences** — debounced auto-save with per-user persistence is elegant
- **Dark-first design** — consistent warm brown/golden palette with proper semantic tokens

## Top 3 Highest-Impact Improvements

1. **Add skeleton `loading.tsx` files** — this single change will make the app feel 2× faster
2. **Add a toast system** — eliminates the "did my action work?" uncertainty across every interaction
3. **Add breadcrumbs** — the app is 4 levels deep (Dashboard → Novel → Chapter → Reader) and users need orientation
