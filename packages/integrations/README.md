# @nyte/integrations

## Purpose

Provider adapters for ingesting external data sources into Nyte intake signals.

## Responsibilities

- Gmail polling adapter + signal normalization
- Google Calendar polling adapter + signal normalization
- provider-level fetch + payload mapping

## Public exports

- main: src/index.ts
- subpaths: ./gmail/polling, ./calendar/polling

## Dependencies

- workspace: @nyte/domain

## Used by

- apps/web API ingestion route
- runtime/background orchestration paths

## Local commands

- `pnpm --filter @nyte/integrations typecheck`
