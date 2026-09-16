# Development Guide

## Requirements

- Node.js 20+
- npm
- Supabase project for authenticated cloud features

## Install

```bash
npm install
```

## Environment

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Required values:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Run

```bash
npm run dev
npm run dev:mobile
```

The desktop command prepares PDF.js and temporarily installs the `better-sqlite3`
binary matching Electron's ABI. When the development server exits, it restores the
host Node.js binary used by Vitest and other CLI tools. If a previous process was
terminated forcefully, `npm run dev` and the test scripts repair the expected ABI
automatically; `npm run native:node` is also available as a manual recovery command.

## Build

```bash
npm run build
```

## Tests

```bash
npm run test
npm run test:run
```

Use focused tests for utility and hook behavior. For Electron IPC changes, verify the desktop flow manually because many native paths rely on the real filesystem.

## Lint

```bash
npm run lint
```

## Common Development Notes

- Renderer code should call native functionality through `window.api`.
- Keep local file writes in Electron, not React components.
- Keep Supabase data access in API helpers.
- Refresh TanStack Query caches after mutating cloud reading data.
- Refresh the local library after filesystem mutations.

## Adding a Library Operation

1. Add or reuse an IPC handler in `electron/main.ts`.
2. Expose the handler in `electron/preload.ts`.
3. Add TypeScript declarations in `electron/electron-env.d.ts`.
4. Call it from the relevant React page or hook.
5. Return `{ success, error }` when the renderer needs user feedback.
