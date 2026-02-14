# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `bun run dev` (runs on http://localhost:4000 with watch mode and HMR)
- **Build (current platform):** `bun run build:server` (outputs to `dist-executables/server`)
- **Build (all platforms):** `bun run build:server:all` (macOS x64/ARM64, Linux x64, Windows x64)
- **Run tests:** `bun test` (uses Bun's built-in test runner)
- **Run single test:** `bun test src/spa.test.ts`

## Architecture

Full-stack monolithic app: Elysia backend serves a React 19 SPA, all running on Bun.

**Backend** (`src/index.ts`): Elysia server with middleware chain (logger → helmet → openapi). API routes return JSON; all other routes proxy to the SPA HTML. The server exports an `App` type used by the frontend for type-safe API calls via Eden Treaty.

**Frontend** (`src/frontend.tsx`, `src/App.tsx`): React 19 app bundled by Bun with `bun-plugin-tailwind`. The HTML template (`src/index.html`) imports `frontend.tsx` as a module, which Bun transpiles and serves.

**SPA Proxy pattern**: The HTML is served through a UUID-based internal route (`/{randomUUID}`) so that all requests pass through Elysia's middleware stack (logging, security headers). A catch-all `/*` route proxies non-API requests to this internal route. This works around Bun's static file serving which would otherwise bypass middleware.

**Build system** (`build-single.ts`, `build-all.ts`): Compiles the entire app into standalone executables using Bun's compile API. Embeds version info and git hash, sets production env, and minifies output.

## Key Conventions

- **Runtime:** Bun (not Node.js) — use `bun` for all commands
- **Path alias:** `@/*` maps to `src/*` (configured in tsconfig.json)
- **Formatting:** 2-space indentation, LF line endings (see .editorconfig)
- **TypeScript:** Strict mode, `react-jsx` transform, bundler module resolution
- **Testing:** Use Elysia's `.handle()` method to test routes without starting the server (see `src/spa.test.ts` for pattern)
