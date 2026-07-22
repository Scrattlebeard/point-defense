# ADR-0001: Adopt the spec → test → code workflow

- **Date:** 2026-07-23
- **Status:** accepted

## Context

AI-assisted development changes the economics of code: writing is cheap, rewriting is often cheaper than reworking, and the human cannot (and does not want to) review every line. Review attention is the scarce resource; it must land where decisions live.

## Decision

Adopt the three-tier structure defined in CLAUDE.md: `.md` specs (conceptual, reviewed) > tests (enforceable spec, reviewed when warranted) > code (reviewed by the tests). Precedence conflicts are bugs, fixed top-down. Work happens in ephemeral worktrees; main's tree is a landing strip. Deferred work goes through PINS.md; significant decisions through ADRs like this one.

## Alternatives considered

- **Conventional code review:** puts the scarce resource (human attention) on the largest, least decision-dense artifact. Rejected.
- **Tests-only as spec (no `.md` tier):** enforceable but not navigable; a human can't survey intent from test suites. Rejected.
- **Docs-only (no enforceable tier):** rots silently, enforces nothing. Rejected.

## Consequences

- Every change starts in an `.md` and ends with green tests; specs stay true because the loop begins there.
- Tests must target public seams only, or the rewrite license this system depends on is revoked.
- ADRs are append-only: superseded, never edited. This file is the format example.
