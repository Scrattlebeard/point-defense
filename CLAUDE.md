# Development philosophy

**Code is ephemeral.** Writing code is cheap for the assistant; rewriting from scratch often beats reworking in place — within the limits the tiers below set.

**Programming is communication with three audiences:** the compiler, the future developer, and the reviewing human. The third audience reads specs and tests, not code. Nothing decision-shaped may live only in code.

**Session start:** read `README.md` — the root spec and the map — before touching anything. Navigate to the relevant module specs from there. (This file governs *how we work*; README.md specifies *what this is*. Neither does the other's job.)

## The three tiers

Precedence: **`.md` > tests > code.** Divergence between tiers is a bug: fix it at the highest tier it touches, then propagate downward.

Divergence means **contradiction, not silence**. A test that pins down behaviour the `.md` doesn't speak to is the tiers working as designed — the only question is whether that delegation was deliberate. Either sharpen the `.md` or decide the detail belongs at test level; both are legitimate resolutions, and a deliberate silence is load-bearing.

1. **`.md` spec** — every module and subfolder carries a spec alongside it: purpose, seams and interfaces, high-level behaviour. Together the specs are the map of the codebase — a human should be able to navigate and understand the system from specs alone, without reading code. A spec with nothing to say ("helpers for the folder above") signals the folder is badly cut, not a license to skip the spec. The spec tree is rooted at **`README.md`**: the repo-level spec — purpose, public seams, the map into module specs, and a quickstart (build / run / test) for readers not yet inside. Same tier, same precedence, same discipline as every other `.md`.

2. **Tests** — the enforceable spec. They carry the gritty behavioural detail so the `.md` can stay conceptual. Write tests that anchor domain behaviour, prevent regressions, or reproduce bugs — never tests for their own sake. Tests exercise **public seams only**: a test that would break under a behaviour-preserving rewrite is a bad test, because it revokes the license to rewrite. Tests must be **fast and deterministic** — they are the inner loop, and a slow or flaky spec stops being enforced. Write them in domain-adjacent language: when the human needs more detail than the `.md` gives, the tests are the next stop.

3. **Code** — makes the tests green. Clean code, low coupling, high cohesion, lean on the type system. Prefer functionally pure domain cores sandwiched between impure orchestrators that own the side effects. What-comments are a smell; small why-comments (with a link to a spec, test, issue or ADR) are fine; big whys become ADRs.

## The development loop — discipline, not a suggestion

**`.md` → failing test → code → green test**

1. **Start in the `.md`.** Read it; update or create as needed. This is also the rot-guard: specs stay true because every change begins by making them true. If a change touches many `.md`s, consider whether it should be broken down further.
2. **Red, then green.** Write failing tests that pin the desired behaviour before writing the implementation.
3. **Code until green.** Rewriting from scratch is fine — that is what the tests are for. If a rewrite scares you, the fear is telling you which tests are missing. Write them first.

When understanding improves, rewrite the tests and, if needed, the `.md` — top tier first, then downward.

**Spike escape hatch:** exploratory spikes, throwaway scripts and prototype fiddling are exempt from the loop — and are explicitly disposable. Nothing graduates into the codebase except through the loop.

## Review protocol

The human reviews **`.md` diffs, and test diffs when warranted**. Code is reviewed by the tests, not by the human. Consequences:

- Every decision, trade-off and resolved ambiguity must be visible at the reviewed tiers. When the assistant resolves an ambiguity, the resolution is written into the `.md` (or a test, when it's nitty-gritty) — never silently into code. An unwritten decision is an unreviewed decision.
- Since tests stand in for human code review, changes that **loosen** them — weakening an assertion, deleting a case, skipping a test — must be called out explicitly, never buried in a diff.

## Pins

Asides and deferred work that surface mid-session — "we should fix this, but not in this session" — go in **`PINS.md`** at the repo root, immediately when they surface, not in an end-of-session sweep from memory.

Each pin carries: **what** (the change), **why it's worth doing**, **where** (files, specs, tests affected), and **enough context to be picked up cold** — the next session has no memory of this one; the pin is the handoff.

- Pins live in `PINS.md`, never as TODO comments in code. A deferred decision is still a decision, and decisions surface at the reviewed tier.
- Pins are **candidates, not commitments**. "Won't do, here's why" is a legitimate resolution — delete the pin; the diff documents the triage.
- Resolved pins are deleted, not archived — git history is the archive. If the resolution was decision-worthy, it exits via an ADR.
- A pin that grows a design discussion has outgrown the file: promote it to a spec change or an ADR draft and leave a one-line pointer.
- A pin untouched across many sessions is a "won't do" wearing a "later" costume — close it honestly.
- *Escalation path:* if entries routinely exceed ~10 lines or parallel sessions cause recurring merge friction, switch to a `/pins` folder, one file per item, same rules. Until then, one file.

## Architectural Decision Records

`/adr` holds significant decisions: what was decided, why, and what alternatives were considered. They carry the story and reasoning that underlies the specs. ADRs are **append-only** — superseded, never edited; that is what makes them the story rather than more mutable spec. Specs, tests and code refer to ADRs, not echo them. The urge to write a paragraph of history into a spec is the urge to write an ADR.

## Branches and worktrees

**Main's working tree is a landing strip, not a workbench.** Agents never write in it. All work — any size — starts by creating a branch + worktree via `scripts/worktree <name>`, which also wires up build caches. Main's tree is touched only to land.

- **Landing:** loop green in the worktree → `scripts/land <name>` (rebase onto current main → fast-forward merge → remove the worktree).
- **Lifetime:** worktree = branch = task. More than ~3 alive means intentions are piling up unfinished — merge or kill.
- Harness-spawned isolation worktrees manage their own lifecycle and don't count.
- The human may work directly in main's tree; the invariant exists to isolate writers who can't see each other.
- *Agent cwd discipline:* `land` removes the worktree and leaves the shell's cwd
  either dead or reset to the repo root — so an agent's next relative-path command
  silently targets main's tree (this bit four times on 2026-07-24 alone). Rule:
  **agents start every shell command with an absolute `cd` into their worktree**;
  relative paths never ride on inherited cwd.
- *Load-bearing prerequisite:* worktree spin-up must be near-free. A discipline that costs two minutes per one-line fix gets skipped, and a skipped discipline is worse than no rule. No script, no rule.

## Working agreement

1. **No silent assumptions — ask or record, by reversibility.** If an ambiguity forks the shape of the spec or is expensive to reverse, ask first. Otherwise pick the most reasonable interpretation, proceed, and record the assumption in the `.md` (or a test) so it passes the review surface. An unrecorded assumption is a silent one; silence is the sin, not the assuming.
2. **Simplest solution that works.** Simple problems get simple solutions; add no flexibility nothing needs yet. Code is ephemeral — generality can be added when the need arrives, by rewrite if necessary.
3. **Don't touch unrelated code.** Smells and design problems discovered en route are surfaced, not fixed in passing: pin them in `PINS.md` and mention them. Drive-by refactors make diffs unreviewable.
4. **Flag uncertainty explicitly.** Where a small, localised, low-risk experiment can convert uncertainty into knowledge, run it as a spike — disposable, outside the loop — and bring hypothesis and results to discuss. Confidence without certainty causes more damage than an admitted gap.
5. **Suggest better ways, unprompted.** Strategic improvements are welcome over tactical ones. If the suggestion isn't this session's work, it becomes a pin; if it's a genuine fork in the road, an ADR draft.
