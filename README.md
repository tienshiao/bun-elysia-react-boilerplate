# Bun + Elysia + React Boilerplate

Full-stack monolithic app: Elysia backend serving a React 19 SPA, all running on Bun.

## Prerequisites

- [Bun](https://bun.sh/)
- PostgreSQL

## Setup

```bash
bun install
```

### Database

The app connects to PostgreSQL via the `DATABASE_URL` env var. Default:

```
postgres://bp_user:bp_password@localhost:5432/boilerplate_development
```

Run migrations:

```bash
bunx drizzle-kit migrate
```

### JWT Keys

Generate an ES256 (ECDSA P-256) key pair:

```bash
mkdir -p keys
openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt -out keys/private.pem
openssl ec -in keys/private.pem -pubout -out keys/public.pem
```

The app loads keys from either:

- PEM files: `keys/private.pem`, `keys/public.pem`
- Environment variables: `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`

## Development

```bash
bun run dev
```

Open http://localhost:4000/ to see the app.

## Build

```bash
# Current platform
bun run build:server

# All platforms (macOS x64/ARM64, Linux x64, Windows x64)
bun run build:server:all
```

Outputs standalone executables to `dist-executables/`.

## Testing

```bash
# Run all tests
bun test

# Run a single test file
bun test src/modules/auth/auth.test.ts
```

Tests use schema-isolated PostgreSQL databases via `makeTestDb()` — each test file gets its own schema (prefixed with `test_`), enabling safe parallel execution. Schemas are preserved after tests for debugging.

## Linting & Formatting

```bash
# Check (CI)
bun run check

# Auto-fix
bun run fix
```

ESLint (flat config) with `typescript-eslint`, `react-hooks`, `react-refresh`, and `simple-import-sort`. Prettier handles formatting (double quotes, semis, trailing commas, 100 print width). The two tools are kept separate — `eslint-config-prettier` disables conflicting rules.
