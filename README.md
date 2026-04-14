# Flashcard Engine - Localhost Setup

This project is a local monorepo for a flashcard app with:

- `artifacts/api-server` - Express + TypeScript backend
- `artifacts/flashcard-engine` - React + Vite frontend
- `lib/*` - shared workspace libraries

The backend now runs as a normal Express server for local development and standard hosting.

## Prerequisites

- Node.js 20+
- pnpm
- A PostgreSQL database
- A Google Gemini API key for flashcard generation

Install pnpm if needed:

```bash
npm install -g pnpm
```

## Environment Variables

Create or update:

`artifacts/api-server/.env`

Required values:

```env
DATABASE_URL=postgresql://...
GEMINI_API_KEY=your_gemini_api_key
SESSION_SECRET=any_long_random_string
PORT=8080
```

Notes:

- `DATABASE_URL` is required by the backend.
- `GEMINI_API_KEY` is required for AI flashcard generation.
- `SESSION_SECRET` can be any long random string for local use.
- `PORT` defaults to `8080` in code, but keeping it in `.env` is recommended.

## Install Dependencies

From the repo root:

```bash
pnpm install
```

If the repo was copied or renamed and local binaries seem broken, do a clean reinstall:

```bash
pnpm install --force
```

## Run Locally

Open two terminals from the repo root.

Terminal 1 - backend:

```bash
pnpm --filter @workspace/api-server run dev
```

Terminal 2 - frontend:

```bash
pnpm --filter @workspace/flashcard-engine run dev
```

Open the app at:

```text
http://localhost:5173
```

The API runs at:

```text
http://localhost:8080
```

## Build for Production

Backend:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

Frontend:

```bash
pnpm --filter @workspace/flashcard-engine run build
```

## Useful Project Structure

```text
artifacts/
  api-server/
    src/
      app.ts
      index.ts
      routes/
      lib/
  flashcard-engine/
    src/
lib/
  api-client-react/
  api-zod/
  db/
```

## Troubleshooting

### Backend fails to start

Check:

- `artifacts/api-server/.env` exists
- `DATABASE_URL` is valid
- `GEMINI_API_KEY` is set
- you ran `pnpm install` from the repo root

### Old `cross-env` or missing module errors

This usually means dependencies were installed before the folder was copied or renamed.

Run:

```bash
pnpm install --force
```

### Gemini generation fails

The API returns a friendly `503` when Gemini is temporarily unavailable.

Check:

- API key is valid
- network access is available
- input text is not empty

### Database push command fails

You do not need a schema push for the code changes made in this workspace unless you are actively changing the DB schema.

## Current Backend Behavior

- Normal Express server
- CORS enabled
- JSON body parsing enabled
- Uses `process.env.PORT || 8080`
- Gemini model: `gemini-2.5-flash`
- Flashcard pipeline:
  - clean text
  - split into semantic chunks
  - generate cards per chunk
  - validate output
  - deduplicate
  - return 5-8 usable cards when possible
