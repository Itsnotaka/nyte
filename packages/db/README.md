# @nyte/db

## Purpose

Shared persistence package for Nyte. Defines Postgres schema, DB client, and migration helpers.

## Responsibilities

- Drizzle Postgres schema definitions
- node-postgres client initialization
- migration config + generated SQL artifacts

## Public exports

- main: src/index.ts
- subpaths: ./client, ./schema

## Dependencies

- external: drizzle-orm, pg

## Used by

- packages/application
- any runtime/service code needing direct DB access

## Environment

- `DATABASE_URL` (Postgres connection string)

## Local commands

- `pnpm --filter @nyte/db typecheck`
- `pnpm --filter @nyte/db generate`
- `pnpm --filter @nyte/db push`
- `pnpm --filter @nyte/db migrate`
- `pnpm --filter @nyte/db studio`
