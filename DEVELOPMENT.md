# DEVELOPMENT.md

Technical notes for the Thai sight-word flashcard app. For the what/why/how-to-run,
see `README.md`. For rules on maintaining this repo (especially keeping these docs
in sync), see `AGENTS.md`.

## Architecture

A static single-page app — no build step, no framework, no network calls. Three
files, loaded relative to each other:

| File | Responsibility |
|---|---|
| `index.html` | Markup + all CSS. Loads `words.js` then `app.js`. Owns the DOM contract (element IDs). |
| `words.js` | **Generated** data: `const MASTER` — the difficulty-ordered word list. Do not hand-edit. |
| `app.js` | All logic: state, persistence, selection, progression, session flow, DOM wiring. |
| `cards.sealang.json` | Source corpus used only to regenerate `words.js`. Not loaded at runtime. |
| `server.sh` | Caddy static file server (LAN-exposed by design; see the file's header). |

The split exists so the large generated word list stays out of the hand-written
logic and markup. The app is a plain SPA and loads sibling scripts by relative
path, so hosting is just "serve this folder."

### DOM contract (shared by index.html and app.js)

`app.js` looks up these element IDs; renaming one means editing both files:
`stats`, `resetBtn`, `card`, `word`, `overlay`, `sessionStat`, `continueBtn`,
`correct`, `wrong`. The overlay starts with class `hidden`.

## The learning model

Two separable concerns (deliberately **not** FSRS — FSRS schedules review of a
fixed card pile; it does not sequence difficulty or decide when to introduce new
material, which is most of what this app does):

### 1. Difficulty axis — `MASTER`

One ordered list of `[word, level]`. Order is the difficulty spine; `level` is the
AUA Reader chapter the word is introduced in (1–60), used only for the progress
readout. The learner is never shown the whole list at once.

### 2. Per-word mastery — Leitner `box`

Each practiced word has `{ box, seen, correct, last }`:

- `box` 0..`MAX_BOX` (5). Correct → `box+1`; wrong → `box−1` (floored at 0).
- `box >= MASTERED_BOX` (4) counts as **learned** (≈4 correct in a row).

### 3. Progression — the `frontier`

`frontier` = how many words from the front of `MASTER` are unlocked (the "active
pool"). When `masteredCount(pool) / pool.size >= ADVANCE_FRAC` (0.8), the next
`BATCH` (5) words unlock. Checked at the start of each sitting, not mid-session,
so new words arrive at a natural boundary.

### 4. Selection — `pickWord()`

Weighted random over the active pool: weight `= (MAX_BOX + 1 − box)`, then `×0.3`
if mastered (occasional maintenance) and `×1.6` if never seen (prioritise new
words). Immediate repeats are avoided. Struggling and brand-new words get the
most airtime; mastered words still appear occasionally.

### 5. Spacing — time decay

The one idea borrowed from spaced repetition: on load, a mastered word whose
`last` timestamp is older than `DECAY_DAYS` (7) drops one box, so it resurfaces
after a gap. No forgetting-curve model, no training.

### 6. Session flow

A sitting is `SESSION_LEN` (20) scored answers. Skips (tapping the word) don't
count. At the end, an overlay shows the sitting's score and total learned; **ไปต่อ**
starts the next sitting (which runs decay + possible frontier advance).

## State & persistence

`localStorage` key `thaiFlash.state.v3`:

```json
{ "cards": { "<word>": { "box": 0, "seen": 0, "correct": 0, "last": 0 } },
  "frontier": 15 }
```

- `last` is `Date.now()` ms. `frontier` is an integer index into `MASTER`.
- **Legacy migration:** if no v3 state exists, `migrateFromWeights()` reads the old
  `thaiFlash.weights.v1` map (per-word frequency weights from the previous
  version). Low weight ⇒ high box (it was being answered correctly). Every seen
  word keeps its mastery, but `frontier` is set to `max(START_POOL, count of
  practiced words)` — sized to past experience, drawn from the easy end, so one
  deep word can't unlock the whole early range.
- **Schema changes must bump the `LS_STATE` version and add a migration** from the
  previous version. Never silently reinterpret an existing shape.

## Tuning knobs (top of `app.js`)

| Const | Default | Meaning |
|---|---|---|
| `START_POOL` | 15 | words unlocked at the very start |
| `SESSION_LEN` | 20 | scored cards per sitting |
| `BATCH` | 5 | words unlocked per advance |
| `MASTERED_BOX` | 4 | box at/above = learned |
| `MAX_BOX` | 5 | top box |
| `ADVANCE_FRAC` | 0.8 | fraction of pool mastered before unlocking more |
| `DECAY_DAYS` | 7 | mastered word unseen this long drops a box |

## Regenerating `words.js`

`words.js` is generated from `cards.sealang.json` (an array of
`{rank, source, thai, english}`; `source` carries the AUA chapter, `rank` is a
separate per-source signal we don't use for ordering). The merge takes AUA Reader
words in chapter order, then appends the project's original curated words that
aren't already present (short → level 1, longer → level 2). Single tokens only.

```bash
python3 - <<'PY'
import json, re
d = json.load(open('cards.sealang.json', encoding='utf-8'))
def tok_ok(w):
    return bool(w) and ' ' not in w and not re.search(r'[a-zA-Z0-9().,/\-]', w) and 1 <= len(w) <= 15
seq = 0; first = {}
for e in d:
    m = re.match(r'AUA Reader AUA Chapter (\d+)', e['source'])
    if not m: continue
    th, lv = e['thai'].strip(), int(m.group(1))
    if tok_ok(th) and (th not in first or lv < first[th][0]):
        first[th] = (lv, seq)
    seq += 1
# merge original curated words here if desired (see git history of words.js header)
master = sorted(first.items(), key=lambda kv: (kv[1][0], kv[1][1]))
buf = [f'["{w}",{lv}]' for w,(lv,_) in master]
out = ['const MASTER = [']
for i in range(0, len(buf), 8):
    out.append('  ' + ','.join(buf[i:i+8]) + (',' if i+8 < len(buf) else ''))
out += ['];', "if (typeof module !== 'undefined') module.exports = { MASTER };"]
open('words.js','w',encoding='utf-8').write('\n'.join(out) + '\n')
print('wrote', len(master), 'words')
PY
node --check words.js
```

Keep the `module.exports` line — it lets the test harness load the data under Node
while being a harmless no-op in the browser.

## Testing

No test framework. Two cheap checks before every commit:

1. **Syntax:** `node --check words.js && node --check app.js`.
2. **Behavior (stubbed-DOM smoke test):** load `words.js` + `app.js` in a Node
   `vm` context with minimal `localStorage`/`document`/`window` stubs, then drive
   the `#correct`/`#continueBtn` click handlers in a loop. Assert: no exceptions,
   `frontier` advances for an all-correct learner, and migration from a seeded
   `thaiFlash.weights.v1` sets boxes and a sane `frontier`. (See git history for a
   ready harness.)

Also sanity-check in a real browser: open the page, confirm a word renders, the
flash feedback fires, the overlay appears after 20 answers, and reset works.
