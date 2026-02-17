# @nyte/db

## Purpose

Shared persistence package for Nyte. Defines schema, DB client, and bootstrap/migration helpers.

## Responsibilities

- Drizzle schema definitions
- libsql/sqlite client initialization
- schema bootstrap for local/dev/test flows
- migration config + generated SQL artifacts

## Public exports

- main: src/index.ts
- subpaths: ./client, ./schema

## Dependencies

- external: drizzle-orm, @libsql/client

## Used by

- packages/application
- any runtime/service code needing direct DB access

## Environment

- `DATABASE_URL` (supports file: URLs and remote URL schemes)

## Local commands

- `pnpm --filter @nyte/db typecheck`
- `pnpm --filter @nyte/db db:generate`
- `pnpm --filter @nyte/db db:push`
- `pnpm --filter @nyte/db db:studio`
