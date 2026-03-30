# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Next.js 16:
- proxy.ts is the new convention for middleware.ts

## Build & Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint (Next.js core-web-vitals + TypeScript)
npm test             # Run all tests (translation tests)
npx tsx --test app/lib/translation/crypto.test.ts  # Run a single test file
npx prisma migrate dev   # Apply database migrations
npx prisma generate      # Regenerate Prisma client
```

## Architecture

**Next.js 16 App Router** with React 19, TypeScript, Tailwind CSS v4, and PostgreSQL via Prisma.

This is a novel management application: users upload .txt/.epub files, read them in-browser, and translate them chapter-by-chapter using multiple AI providers.

### Key Layers

- **`app/`** — Next.js App Router pages and API routes. Pages are Server Components by default; interactive parts use `"use client"`.
- **`app/lib/`** — Business logic and data access. `novels.ts` (CRUD), `storage.ts` (file I/O), `reader/` (txt/epub parsing), `translation/` (multi-provider translation engine with adapter pattern).
- **`app/api/`** — REST endpoints: `/uploads` (file upload), `/translation/profiles` (API key management), `/translation/novels/[novelId]/jobs` (start translations), `/translation/jobs/[translationId]/*` (run/retry/export). Also: `/reading/preferences` (user reading preferences).
- **`app/lib/reading-progress.ts`** — Chapter visit tracking and reading progress persistence.
- **`app/lib/reading-preferences.ts`** — User reading preferences (font size, theme, font family).
- **`components/ui/`** — shadcn/ui components (base-nova style). Config in `components.json`.
- **`prisma/schema.prisma`** — Models: `Novel`, `TranslationProfile`, `NovelTranslation`, `NovelTranslationChapter`, `ReadingProgress`, `ChapterVisit`, `UserReadingPreferences`. Prisma client generated to `app/generated/prisma/`.

### Translation System

Adapter pattern for AI providers (`app/lib/translation/adapters/`). Supported: OpenAI, Anthropic, DeepSeek, OpenRouter, MiniMax. API keys are encrypted with AES-256-GCM using `TRANSLATION_ENCRYPTION_SECRET`.

### Authentication

Auth.js (NextAuth v5) via `@/auth`. All API routes and server pages call `auth()` for session. Multi-user data isolation: always filter queries by `session.user.id`.

### Path Alias

`@/*` maps to project root (e.g., `@/components/ui/button`).

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (required)
- `TRANSLATION_ENCRYPTION_SECRET` — AES key for API key encryption (required for translation)

## Testing

Uses Node.js native test runner (`node:test`) with `tsx`. Tests live alongside source in `app/lib/translation/*.test.ts`. No Jest/Vitest.

## Prisma Workflow

After any `schema.prisma` change: run `npx prisma migrate dev` then `npx prisma generate`. The generated client at `app/generated/prisma/` must be regenerated for type changes to take effect.

## Styling

Tailwind CSS v4 with CSS-first configuration in `globals.css` (no `tailwind.config`). Fonts: Playfair Display (headings), Source Sans 3 (body).

<!-- GSD:project-start source:PROJECT.md -->
## Project

**InkRealm**

InkRealm is a personal novel management app where users upload .txt/.epub files, read them in-browser, and translate them chapter-by-chapter using AI providers. This milestone is a comprehensive UI/UX overhaul — rebranding from a plain "Library" to "InkRealm" with a dark fantasy study aesthetic, and completely rethinking the translation workflow from a confusing multi-step process to a seamless one-click experience.

**Core Value:** Translation must feel effortless — one click to translate an entire novel, with progress visible everywhere the user looks (novel page, chapter list, reader).

### Constraints

- **Tech stack**: Must stay on Next.js 16, React 19, Tailwind CSS v4, shadcn/ui, Prisma — no framework changes
- **Backend stability**: Translation service layer, adapters, and API structure should remain largely intact — this is a UI/UX initiative
- **Target language**: Hardcoded to Vietnamese — no i18n needed for the translation target
- **Quality preset**: Always premium — sequential chapter translation
- **Dark-first**: Dark mode is the primary design, light mode is secondary but must still feel cohesive
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.x - All application code (`app/`, `components/`, config files)
- CSS - Tailwind CSS v4 with CSS-first configuration in `app/globals.css`
## Runtime
- Node.js 20 (specified in `.github/workflows/ci.yml`)
- npm
- Lockfile: `package-lock.json` present
## Frameworks
- Next.js 16.2.1 - Full-stack React framework with App Router. Note: uses `proxy.ts` instead of `middleware.ts` as the new middleware convention.
- React 19.2.4 - UI rendering. Server Components by default; `"use client"` for interactive parts.
- shadcn/ui 4.1.1 - Component system with base-nova style. Config: `components.json`. Components in `components/ui/`.
- @base-ui/react 1.3.0 - Underlying primitive components for shadcn
- Tailwind CSS 4.x - CSS-first config in `app/globals.css` (no `tailwind.config` file)
- @tailwindcss/postcss 4.x - PostCSS integration; config in `postcss.config.mjs`
- tailwind-merge 3.5.0 - Utility for merging Tailwind class names
- tw-animate-css 1.4.0 - Animation utilities
- class-variance-authority 0.7.1 - Variant-based component styling
- Node.js native `node:test` runner - No Jest or Vitest
- tsx 4.21.0 - TypeScript execution for test runner
- Next.js CLI (`next dev`, `next build`, `next start`)
- tsx 4.21.0 - Used for running tests directly
## Key Dependencies
- `next-auth` 5.0.0-beta.30 (Auth.js v5) - Authentication with Google OAuth and credentials providers. Config: `auth.ts`.
- `@auth/prisma-adapter` 2.11.1 - Bridges Auth.js session persistence to Prisma/PostgreSQL
- `prisma` 7.6.0 / `@prisma/client` 7.6.0 - ORM for PostgreSQL. Schema at `prisma/schema.prisma`. Client generated to `app/generated/prisma/`.
- `@prisma/adapter-pg` 7.6.0 - pg driver adapter for Prisma. Used in `app/lib/prisma.ts` via `PrismaPg`.
- `pg` 8.20.0 - PostgreSQL client (Node.js). Used for connection pool.
- `bcrypt` 6.0.0 - Password hashing for credential-based auth. Used in `auth.ts` and registration flows.
- `resend` 6.9.4 - Transactional email for password reset. Used in `app/lib/email.ts`.
- `adm-zip` 0.5.16 - EPUB extraction (`.epub` files are ZIP archives). Used in `app/lib/reader/epub.ts`.
- `fast-xml-parser` 5.5.9 - XML/HTML parsing for EPUB content.
- `dotenv` 17.3.1 - Environment variable loading for Prisma config (`prisma.config.ts`)
- `lucide-react` 1.7.0 - Icon library (configured as icon library in `components.json`)
- `clsx` 2.1.1 - Conditional class name utility
## Configuration
- Configured via `.env` file (gitignored). Template at `.env.example`.
- Key variables: `DATABASE_URL`, `TRANSLATION_ENCRYPTION_SECRET`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `next.config.ts` - Minimal Next.js config (no custom options)
- `tsconfig.json` - TypeScript config. Target ES2017. Path alias `@/*` maps to project root.
- `postcss.config.mjs` - PostCSS with `@tailwindcss/postcss` plugin
- `eslint.config.mjs` - ESLint with `eslint-config-next` core-web-vitals + TypeScript rules
- `prisma.config.ts` - Prisma config with schema path and migration path
## Platform Requirements
- Node.js 20+
- PostgreSQL database running locally
- `DATABASE_URL` env var set
- `TRANSLATION_ENCRYPTION_SECRET` for translation feature
- `AUTH_SECRET` for Auth.js
- Optional: Google OAuth credentials, Resend API key
- No specific deployment target detected. Deployable to any Node.js hosting (Vercel, Railway, etc.)
- PostgreSQL database required
- All env vars from `.env.example` required
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- React page components: `page.tsx` (co-located in route directory)
- Client components that accompany a page: `[feature]-client.tsx` (e.g., `settings-client.tsx`, `login-form.tsx`)
- Feature panels co-located with pages: `[feature]-panel.tsx` (e.g., `translation-panel.tsx`, `glossary-panel.tsx`)
- Custom hooks: `use-[feature-name].ts` (e.g., `use-translation-polling.ts`)
- Library modules: kebab-case `[domain].ts` (e.g., `reading-progress.ts`, `quality-presets.ts`)
- Test files: `[module].test.ts` co-located with source (e.g., `crypto.test.ts` beside `crypto.ts`)
- Type definition files: `types.ts` within feature directory
- camelCase for all functions (e.g., `createTranslationProfile`, `parseCreateProfilePayload`, `handleTranslationRouteError`)
- Boolean functions prefixed with `can` or `is` (e.g., `canRetryTranslationStatus`, `canRunTranslationStatus`, `canDownloadTranslationExport`)
- Assertion functions prefixed with `assert` (e.g., `assertTranslationEncryptionConfigured`)
- Parser functions prefixed with `parse` (e.g., `parseRequiredString`, `parseOptionalString`, `parseProvider`)
- Getter functions prefixed with `get` (e.g., `getNovelById`, `getTranslationProfileCredential`)
- List functions prefixed with `list` (e.g., `listNovels`, `listTranslationProfiles`)
- Creation functions prefixed with `create` (e.g., `createNovel`, `createTranslationProfile`)
- Update functions prefixed with `update` (e.g., `updateTranslationProfile`, `updateChapterSummary`)
- Record/DB-layer functions suffixed with `Record` (e.g., `createTranslationProfileRecord`, `updateTranslationProfileRecord`)
- "OrNotFound" suffix for functions that call `notFound()` on missing data (e.g., `getNovelByIdOrNotFound`)
- camelCase for all variables
- Plural names for arrays (e.g., `createdNovelIds`, `exportPaths`, `profileList`)
- Boolean variables use past-tense or descriptive names (e.g., `hasFailure`, `isReadable`)
- PascalCase for types, interfaces, and classes (e.g., `TranslationHttpError`, `ReaderUnavailableError`, `TranslationAdapter`)
- `type` preferred over `interface` for data shapes; `interface` used only for behavioural contracts (e.g., `TranslationAdapter`)
- Types for props suffixed with `Props` (e.g., `TranslationPanelProps`, `NovelDetailsViewProps`)
- Input types suffixed with `Input` (e.g., `NovelCreateInput`, `TranslateChapterInput`)
- Output types suffixed with `Output` (e.g., `TranslateChapterOutput`)
- View types suffixed with `View` when derived from DB types for display (e.g., `TranslationJobView`)
- Serialized cross-boundary types prefixed with `Serialized` (e.g., `SerializedTranslationProfile`, `SerializedTranslationJob`)
- SCREAMING_SNAKE_CASE for module-level constants (e.g., `ALGORITHM`, `IV_LENGTH`, `TOKEN_VERSION`, `ADAPTER_BY_PROVIDER`, `MAX_FILE_SIZE_BYTES`)
## Code Style
- No Prettier config present — formatting enforced by ESLint only
- Trailing semicolons used
- Double quotes for strings in TSX; double quotes throughout
- 2-space indentation (inferred from source)
- ESLint 9 with flat config (`eslint.config.mjs`)
- Rules: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
## Import Organization
- `@/*` maps to project root (defined in `tsconfig.json`)
- Use `@/app/lib/...` for library modules
- Use `@/components/ui/...` for shadcn/ui components
- Use `@/app/generated/prisma/client` for generated Prisma types
- `import type` used for type-only imports (e.g., `import type { Novel }`, `import type { TranslationAdapter }`)
- Named exports preferred over default exports for library modules and components
- `"dotenv/config"` imported as side-effect-only import at top of integration test files
## Error Handling
- Custom `TranslationHttpError` class (`app/lib/translation/errors.ts`) carries `status: number` and `message: string`
- All translation layer errors thrown as `TranslationHttpError` with appropriate HTTP status codes
- API route handlers catch `TranslationHttpError` via `handleTranslationRouteError` and return `NextResponse.json({ error })` with matching status
- Unknown errors fall through to 500 with message extracted via `toErrorMessage(error)`
- Parser functions in `app/lib/translation/validation.ts` throw `TranslationHttpError(400, ...)` for invalid input
- File upload validation in `app/lib/validation.ts` returns `ValidationResult { valid, error? }` — no throw, caller checks
- `TranslationHttpError` — `app/lib/translation/errors.ts`
- `ReaderUnavailableError` — `app/lib/reader/types.ts`
- `InvalidChapterIndexError` — `app/lib/reader/types.ts`
## Logging
- `console.error` used with a descriptive string + object argument (e.g., `console.error("Failed to store uploaded file", { fileName, error })`)
- Logging only on unexpected server-side errors; not on validation failures or auth rejections
- Translation route errors logged via `handleTranslationRouteError` in `app/lib/translation/http.ts`
## Comments
## Function Design
- Complex inputs use typed objects (e.g., `NovelCreateInput`, `TranslateChapterInput`)
- `userId: string` passed explicitly as the last argument to all user-scoped service functions — never read from session inside lib layer
- `payload: unknown` used at service layer entry points; parsing handled internally
- Async functions return `Promise<T>` (typed)
- Functions returning possibly-null DB records return `T | null`
- Void async functions declare `Promise<void>` (e.g., `recordChapterVisit`)
## Module Design
- Named exports only; no default exports in lib or API modules
- React Server Components use named exports (e.g., `export function NovelDetailsView`)
- Client components declared `"use client"` at the very top line (line 1), before any imports
- `app/lib/reader/index.ts` re-exports public types and functions from the reader module
- `app/lib/translation/adapters/index.ts` re-exports adapter types and the `getTranslationAdapter` factory
- Feature-level barrel files used to present a clean public API for each module
- `data.ts` — raw Prisma queries and select objects, exports DB types
- `service.ts` / `profiles.ts` — business logic orchestration, calls data layer
- `validation.ts` — input parsing and sanitization
- `http.ts` — route helpers (error handler, JSON reader)
- API routes import service layer, never data layer directly
## React Conventions
- Pages (`page.tsx`) are Server Components by default; they call `auth()` and pass serialized data as props
- Interactive components use `"use client"` directive on line 1
- Dates passed across server/client boundary as ISO strings (`createdAt: string`, `updatedAt: string`) — not `Date` objects
- Types for serialized props use `Serialized` prefix (e.g., `SerializedTranslationProfile`)
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Pages are React Server Components by default; client interactivity is isolated to `"use client"` leaf components
- Business logic lives in `app/lib/` and is never imported directly by client components — only by Server Components and API route handlers
- All API routes and server pages call `auth()` (Auth.js v5) before touching any data; user isolation is enforced at the data layer by always scoping queries to `session.user.id`
- Translation is an async batch process: the client polls `/api/translation/jobs/[translationId]/status` after triggering a run
## Layers
- Purpose: Enforce session presence before protected routes are reached
- Location: `proxy.ts` (Next.js 16 convention — replaces `middleware.ts`)
- Contains: Cookie-based session check, redirect to `/login` for pages, 401 for API routes
- Depends on: Nothing (reads raw cookies only, no Prisma)
- Used by: Next.js runtime on every matched request
- Purpose: Render HTML server-side, fetch data directly from `app/lib/`, pass serializable props to client components
- Location: `app/dashboard/page.tsx`, `app/novels/[novelId]/page.tsx`, `app/novels/[novelId]/read/[chapterIndex]/page.tsx`, `app/settings/page.tsx`, `app/login/page.tsx`, `app/register/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`
- Contains: `auth()` call, data fetching, prop assembly, layout composition
- Depends on: `@/auth`, `app/lib/*`, `components/*`, `app/components/*`
- Used by: Next.js App Router
- Purpose: REST endpoints consumed by client components; enforce auth, parse input, delegate to service functions
- Location: `app/api/`
- Contains: `auth()` guard, input parsing via `app/lib/translation/validation.ts`, delegation to lib service functions, JSON responses
- Depends on: `@/auth`, `app/lib/*`
- Used by: Client components, external polling
- Purpose: Orchestrate domain operations; the only layer that coordinates multiple lib modules
- Location: `app/lib/translation/service.ts` (translation), `app/lib/novels.ts` (CRUD), `app/lib/reading-progress.ts`, `app/lib/reading-preferences.ts`
- Contains: Multi-step workflows (create job → run batch → finalize), error wrapping with `TranslationHttpError`
- Depends on: `app/lib/translation/data.ts`, `app/lib/translation/adapters/`, `app/lib/reader/`, `app/lib/translation/export.ts`
- Used by: API route handlers and Server Component pages
- Purpose: All direct Prisma queries; thin wrappers returning typed records
- Location: `app/lib/novels.ts`, `app/lib/translation/data.ts`, `app/lib/translation/profiles.ts`, `app/lib/translation/glossary.ts`, `app/lib/reading-progress.ts`, `app/lib/reading-preferences.ts`
- Contains: `prisma.*` calls, no business logic
- Depends on: `app/lib/prisma.ts`, Prisma generated client at `app/generated/prisma/`
- Used by: Service layer and Server Component pages directly for simple reads
- Purpose: Parse `.txt` and `.epub` files into a normalized `ReaderDocument` structure
- Location: `app/lib/reader/` (`service.ts`, `epub.ts`, `text.ts`, `types.ts`, `index.ts`)
- Contains: File I/O via `readFile`, chapter normalization, `ReaderUnavailableError` / `InvalidChapterIndexError`
- Depends on: Node.js `fs/promises`, `app/lib/storage.ts` (for path resolution)
- Used by: `app/lib/translation/service.ts`, server page `app/novels/[novelId]/read/[chapterIndex]/page.tsx`
- Purpose: Abstract AI provider differences behind a single `TranslationAdapter` interface
- Location: `app/lib/translation/adapters/` (`types.ts`, `index.ts`, `anthropic.ts`, `openai-compatible.ts`, `shared.ts`)
- Contains: Provider-specific HTTP calls; `AnthropicAdapter` and `OpenAiCompatibleAdapter` (covers OpenAI, DeepSeek, OpenRouter, MiniMax)
- Depends on: `TranslationAdapterContext` (provider, model, apiKey, baseUrl)
- Used by: `app/lib/translation/service.ts` exclusively
- Purpose: Local filesystem persistence for uploaded novel files and translation exports
- Location: `app/lib/storage.ts`, `app/lib/translation/export.ts`
- Contains: `writeNovelFile` writes to `storage/novels/`, `writeTranslatedExportFile` writes to `storage/translations/`
- Depends on: Node.js `fs/promises`
- Used by: Upload API route, translation service
- Purpose: Reusable presentational components; shadcn/ui base components plus application-specific layouts
- Location: `components/ui/` (shadcn: `button.tsx`, `card.tsx`, `input.tsx`), `components/` (app layout: `library-shelf.tsx`, `bookshelf-row.tsx`, `book-cover.tsx`, `user-menu.tsx`), `app/components/` (feature: `NovelList.tsx`, `UploadForm.tsx`)
- Contains: Client components with `"use client"` where interactivity is needed
- Depends on: Tailwind CSS v4 via `app/globals.css`
- Used by: Server Component pages
## Data Flow
- Server state: PostgreSQL via Prisma (all persistent state)
- Client state: local React state in client components (form fields, UI toggles)
- Reading preferences: persisted per-user in `UserReadingPreferences` table; loaded server-side on chapter page render
- Translation progress: polled from server via `use-translation-polling.ts` in the novel detail page
## Key Abstractions
- Purpose: Common interface that all AI provider adapters implement
- Examples: `app/lib/translation/adapters/anthropic.ts`, `app/lib/translation/adapters/openai-compatible.ts`
- Pattern: `translateChapter(context: TranslationAdapterContext, input: TranslateChapterInput): Promise<TranslateChapterOutput>`; new providers only need to implement this one method
- Purpose: Normalized chapter structure produced by parsing any supported file format
- Examples: `app/lib/reader/types.ts`, produced by `app/lib/reader/service.ts`
- Pattern: `{ novelId, novelTitle, fileType, chapters: ReaderChapter[], chapterCount }` — consumed identically by reading UI and translation engine
- Purpose: Domain error class that carries an HTTP status code, used to produce correct API responses without leaking internal errors
- Examples: `app/lib/translation/errors.ts`
- Pattern: Thrown in lib, caught in `handleTranslationRouteError()` in `app/lib/translation/http.ts`
## Entry Points
- Location: `app/layout.tsx`
- Triggers: Every page render
- Responsibilities: Apply Google Fonts CSS variables, set html/body baseline styles
- Location: `app/page.tsx`
- Triggers: GET `/`
- Responsibilities: Public marketing page with link to `/dashboard`
- Location: `proxy.ts`
- Triggers: Every request matching `matcher` config (dashboard, novels, settings, upload/translation APIs)
- Responsibilities: Cookie-based auth gate; redirects unauthenticated users
- Location: `auth.ts`
- Triggers: Every `auth()` call, Auth.js callback routes
- Responsibilities: Session resolution, Google OAuth + credentials providers, account conflict handling, session token management
- Location: `app/lib/prisma.ts`
- Triggers: First import in any server context
- Responsibilities: Single shared `PrismaClient` instance using `pg` connection pool; singleton pattern via `globalThis` for dev hot-reload safety
## Error Handling
- `TranslationHttpError(status, message)` — thrown anywhere in the translation stack; carries the intended HTTP status
- `ReaderUnavailableError` — thrown by reader layer when file cannot be parsed; caught in service layer and translated to `TranslationHttpError(400, ...)` or `notFound()`
- `InvalidChapterIndexError` — thrown by reader for out-of-range chapter index; caught in page to call `notFound()`
- API routes wrap entire handler body in `try/catch`; unrecognized errors log to `console.error` and return 500
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
