# @nyte/pi-runtime

## Purpose

PI extension contracts and registry for provider execution.

## Responsibilities

- define extension request/result contracts
- define canonical extension-name constants (`PI_EXTENSION_NAMES`)
- define canonical audit source constants (`PI_AUDIT_SOURCES`)
- define canonical auth provider constants (`PI_AUTH_PROVIDERS`)
- expose runtime guard helper (`isPiExtensionResult`) for downstream contract validation
- expose runtime guard helper (`isPiExtensionName`) for extension-name validation
- expose extension handlers for Gmail and Calendar
- provide registry and overload-based typed execution function (no unsafe request cast)

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
