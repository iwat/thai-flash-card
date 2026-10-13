# AGENTS.md

Guidance for an LLM/agent maintaining this repo. Read this, `README.md`, and
`DEVELOPMENT.md` before making changes. Your job is to keep the code working **and**
keep all three documents consistent with each other and with the code.

## What this project is (in one breath)

A static single-page flashcard app for drilling Thai sight words with a young
child in short sittings. Difficulty-ordered (like Dolch/Fry), not themed. Adaptive
via Leitner boxes + an unlocking frontier + light time-decay. No build, no network,
no framework. Three runtime files: `index.html`, `words.js` (generated), `app.js`.

## Non-negotiable invariants

Do not break these without the user explicitly asking:

1. **Single-page, zero-build, offline.** No frameworks, bundlers, or runtime network
   calls. Scripts load by relative path. Splitting logic into more sibling `.js`
   files is fine; adding a build step or CDN dependency is not.
2. **`words.js` is generated.** Never hand-edit word entries. Change the data by
   regenerating from `cards.sealang.json` (snippet in `DEVELOPMENT.md`). Keep the
   generated-file header and the `module.exports` footer.
3. **Pure-Thai child UI.** On-screen text stays Thai (English only as the small
   button sub-labels already present). Keep it simple enough for a 6-year-old.
4. **It is not FSRS and has no themed decks.** Both were considered and rejected
   (see the design discussion). Don't reintroduce either without the user asking.
5. **localStorage is the only persistence.** Schema changes bump the `LS_STATE`
   version and ship a migration from the prior version. Never silently reinterpret
   an existing saved shape.
6. **Progress is sacred.** Changes must preserve a returning child's learned state,
   via migration if needed.

## Per-turn checklist

Follow this every turn that changes anything:

1. **Orient.** Re-read `README.md`, `DEVELOPMENT.md`, and this file. Confirm the
   request fits the invariants above; if it doesn't, say so before coding.
2. **Change the code.** Keep tuning values as named constants at the top of
   `app.js` (never magic numbers inline).
3. **Verify (required):**
   - `node --check words.js && node --check app.js`.
   - Run the stubbed-DOM smoke test (`DEVELOPMENT.md` → Testing): no exceptions,
     frontier advances for an all-correct learner, migration still sane.
   - If you touched data generation, regenerate `words.js` and re-run both.
4. **Sync the docs** using the matrix below — in the **same** change, not "later."
5. **If the state schema changed:** bump `LS_STATE`, add the migration, and update
   the State section of `DEVELOPMENT.md`.
6. **Commit** (see Commit rules). One logical concern per commit.
7. **Report** what changed, what you verified, and which docs you updated.

## Doc-consistency matrix

When you change… | update…
---|---
A tuning knob / default | `DEVELOPMENT.md` knob table; `README.md` only if the user-visible behavior changes (e.g. session length, "about a week")
The learning model (box, frontier, selection, decay, session) | `DEVELOPMENT.md` model section; `README.md` "Why it works this way" if the child-facing behavior changes
State schema / migration | `DEVELOPMENT.md` State section; bump `LS_STATE`
A DOM element ID or the file split | `DEVELOPMENT.md` Architecture + DOM contract; both `index.html` and `app.js`
Word data or its generation | regenerate `words.js`; `DEVELOPMENT.md` regeneration snippet; `README.md` "The words" if the source/attribution changes
How to run / controls | `README.md`
Invariants or this process | this file

If a change touches nothing a doc describes, note that explicitly in your report
rather than skipping the matrix silently.

## Commit rules

- A git hook enforces **Conventional Commits**:
  `type(scope): summary` with type in
  `chore|config|docs|feat|fix|perf|refactor|style|test`, summary lowercase, no
  trailing period. Example: `feat(engine): add time-decay for mastered words`.
- Build/verify before committing. Do not `git push` (leave publishing to the user).
- Keep commits scoped: code and its matching doc updates belong together; unrelated
  changes go in separate commits.

## Good first commands

```bash
node --check words.js && node --check app.js   # fast sanity
./server.sh                                      # try it in a browser (LAN)
BIND=127.0.0.1 ./server.sh                       # local-only
```
