# ADR 001: Modular monolith with explicit ports

## Status

Accepted and being introduced incrementally.

## Context

Lyceum serves desktop and mobile clients and integrates SQLite, the filesystem,
Electron, Capacitor, Supabase, PDF.js and conversion workers. Several historical
entry points accumulated business rules and infrastructure concerns, making a
small feature require coordinated edits across unrelated files.

## Decision

Lyceum remains one deployable product, organized as a modular monolith. New and
migrated features use these dependency directions:

```text
UI / IPC -> application -> domain <- infrastructure adapters
```

- `src/core` contains framework-independent models and ports.
- `src/features` owns application behavior and renderer UI by feature.
- `electron/infrastructure` implements core ports for desktop.
- `electron/handlers` adapts typed IPC calls to application or repository APIs.
- `electron/app` contains process bootstrap concerns only.
- `Window.api` is inferred from `electron/preload.ts`, the single bridge contract.

Existing code is migrated by vertical slice. Moving files without first
separating responsibilities is intentionally avoided.

## Consequences

- Domain behavior can be reused by desktop and mobile.
- Native and cloud integrations become replaceable in tests.
- Temporary compatibility adapters may depend on legacy modules while a slice
  is migrated; the direction is documented in their source.
- Architecture checks and an incremental strict TypeScript configuration prevent
  new code from reintroducing the previous coupling.
- Renderer feature modules cannot depend on page components. Shared filtering,
  sorting and view-model rules live under the owning feature instead of inside
  large React pages.
- SQLite DDL is isolated from the database facade so schema compatibility can be
  verified against an in-memory database without starting Electron.
