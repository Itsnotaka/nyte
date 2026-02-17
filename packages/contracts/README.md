# @nyte/contracts

## Purpose

Shared runtime boundary contracts used between web gateway and runtime service.

## Responsibilities

- command/result types for runtime operations
- runtime command type guards and validation helpers
- endpoint/type mapping stability across services

## Public exports

- main: src/index.ts

## Dependencies

- no runtime deps

## Used by

- apps/runtime
- apps/web (runtime client/edge integration points)

## Local commands

- `pnpm --filter @nyte/contracts typecheck`
