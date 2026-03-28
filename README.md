# Novel Dashboard Upload

This app provides a small novel management surface where you can upload `.txt` and `.epub` files and see them listed in a dashboard backed by PostgreSQL + Prisma.

## Prerequisites

- Node.js 20+
- A running PostgreSQL instance

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` in the project root:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME"
```

3. Apply database migrations:

```bash
npx prisma migrate dev
```

4. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000` and then go to `/dashboard`.

## Upload Behavior

- Accepts exactly one file per request
- Supported types: `.txt`, `.epub`
- Maximum file size: 50 MB
- Uploaded files are written to `storage/novels/` (ignored by git)

## Checks

```bash
npm run lint
npm run build
```
