# @nyte/extension-runtime

## Purpose

Extension contracts and execution runtime for provider actions.

## Responsibilities

- define extension request/result contracts
- define canonical extension-name constants (`EXTENSION_NAMES`)
- define canonical audit source constants (`EXTENSION_AUDIT_SOURCES`)
- define canonical auth provider constants (`EXTENSION_AUTH_PROVIDERS`)
- define canonical auth scopes constants (`EXTENSION_AUTH_SCOPES`)
- expose runtime guard helper (`isExtensionResult`) for downstream contract
  validation
- expose runtime guard helper (`isExtensionName`) for extension-name validation
- expose extension handlers for Gmail and Calendar
- provide registry and overload-based typed execution function (no unsafe
  request cast)

## Public exports

- contracts from `src/contracts.ts`
- executor from `src/execute-extension.ts`

## Dependencies

- workspace: @nyte/domain

## Used by

- packages/workflows

## Local commands

- `pnpm --filter @nyte/extension-runtime typecheck`
