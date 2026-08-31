# Contributing to TransitLab

Thanks for helping improve TransitLab. Contributions should preserve the separation between UI, HTTP/application services, domain routing, and persistence.

## Development setup

```bash
npm install
npm run db:init
npm run dev
```

Create a focused branch and keep pull requests small enough to review. Do not commit `.env`, SQLite database files, build output, or generated coverage reports.

## Before opening a pull request

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
```

Describe the behavior change, the relevant tests, and any migration or import-schema impact. Include before/after screenshots for visible changes.

## Engineering guidelines

- Keep graph and routing logic in `src/domain` free of Next.js and Prisma imports.
- Validate untrusted bodies with the shared Zod schemas at the route-handler boundary.
- Put orchestration in services and data access in repositories.
- Add a versioned Prisma migration for schema changes; never edit an applied migration.
- Preserve deterministic ordering and add regression tests for algorithm changes.
- Treat disruptions and accessibility as routing constraints, not presentation-only state.
- Keep controls keyboard accessible and preserve visible focus states and contrast.
- Avoid new dependencies when a small, clear implementation is sufficient.

## Tests

Domain behavior belongs in colocated `*.test.ts` files. API and persistence behavior belongs in the server integration suite, which uses only `prisma/test.db`. Never point tests at `prisma/dev.db`.

Bug fixes should include a test that fails without the fix. New API endpoints should cover success, validation failure, and persistence effects.

## Network data changes

Network import data must conform to schema version 1 in `src/shared/contracts.ts`. If you update the built-in Alder City seed, keep its identifiers deterministic and update tests or screenshots affected by the topology.

By contributing, you agree that your contribution is licensed under the MIT License.
