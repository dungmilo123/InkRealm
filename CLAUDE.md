# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

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
- **`app/api/`** — REST endpoints: `/uploads` (file upload), `/translation/profiles` (API key management), `/translation/novels/[novelId]/jobs` (start translations), `/translation/jobs/[translationId]/*` (run/retry/export).
- **`components/ui/`** — shadcn/ui components (base-nova style). Config in `components.json`.
- **`prisma/schema.prisma`** — Models: `Novel`, `TranslationProfile`, `NovelTranslation`, `NovelTranslationChapter`. Prisma client generated to `app/generated/prisma/`.

### Translation System

Adapter pattern for AI providers (`app/lib/translation/adapters/`). Supported: OpenAI, Anthropic, DeepSeek, OpenRouter, MiniMax. API keys are encrypted with AES-256-GCM using `TRANSLATION_ENCRYPTION_SECRET`.

### Path Alias

`@/*` maps to project root (e.g., `@/components/ui/button`).

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (required)
- `TRANSLATION_ENCRYPTION_SECRET` — AES key for API key encryption (required for translation)

## Testing

Uses Node.js native test runner (`node:test`) with `tsx`. Tests live alongside source in `app/lib/translation/*.test.ts`. No Jest/Vitest.

## Styling

Tailwind CSS v4 with CSS-first configuration in `globals.css` (no `tailwind.config`). Fonts: Playfair Display (headings), Source Sans 3 (body).
