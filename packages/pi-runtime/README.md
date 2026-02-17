# @nyte/pi-runtime

## Purpose

PI extension contracts and registry for provider execution.

## Responsibilities

- define extension request/result contracts
- expose runtime guard helper (`isPiExtensionResult`) for downstream contract validation
- expose extension handlers for Gmail and Calendar
- provide registry and generic execution function

## Public exports

- contracts from `src/contracts.ts`
- registry from `src/registry.ts`
- executor from `src/execute-extension.ts`

## Dependencies

- workspace: @nyte/domain

## Used by

- packages/workflows

## Local commands

- `pnpm --filter @nyte/pi-runtime typecheck`
