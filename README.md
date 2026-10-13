# บัตรคำ · Thai Sight Words

A tiny, phone-friendly flashcard app for drilling Thai **sight words** with a
young child, one short sitting at a time.

## What it is

A single HTML page. You see one Thai word, large and centered. You (or your
child) decide whether they read it correctly and tap **ถูก (Correct)** or
**ผิด (Wrong)**. That's the whole interaction. No accounts, no network, no ads.
Progress is saved locally in the browser.

## Why it works this way

It imitates how English sight words are taught (Dolch / Fry lists): the most
common, most useful words first, in **difficulty order** — not grouped by theme.
The app holds one long list of Thai words ordered roughly easiest-to-hardest and
only ever shows your child the slice they've "unlocked" so far.

Three things make it adaptive instead of a fixed deck:

- **It focuses on the hard words.** Words answered wrong come back more often;
  words answered right drift into the background.
- **It grows with the child.** Once most of the current words are solid, a few
  new (slightly harder) words are added automatically. There are no decks to
  pick — each sitting is generated from what the child currently knows.
- **It remembers across days.** A word your child hasn't seen in about a week
  quietly resurfaces, so earlier words don't get forgotten.

A sitting is 20 cards, then a short "เยี่ยมมาก! 🎉" screen so there's a natural
stopping point. Tap **ไปต่อ** to keep going.

## How to run

It's a static page, so any static web server works. The included script uses
[Caddy](https://caddyserver.com/docs/install):

```bash
./server.sh                 # serves on 0.0.0.0:9999 (reachable from an iPad on your LAN)
BIND=127.0.0.1 ./server.sh  # this machine only
PORT=8080 ./server.sh       # custom port
```

Then open `http://<your-machine-ip>:9999/` on the device you want to use.

> The server binds to your LAN by design so a tablet can reach it. The content
> is non-sensitive public vocabulary with no login. Use `BIND=127.0.0.1` if you
> want it local-only.

No build step. You can also just open `index.html` with any other static
server; it loads `words.js` and `app.js` from the same folder.

## Controls

| Action | Touch | Keyboard |
|---|---|---|
| Correct | tap **ถูก** | → |
| Wrong | tap **ผิด** | ← |
| Skip (no score) | tap the word | Space |
| Continue after a sitting | tap **ไปต่อ** | Enter / Space |
| Reset all progress | tap **รีเซ็ต** | — |

Progress lives in the browser's `localStorage`, so it's per-device and
per-browser. Resetting is permanent.

## The words

The vocabulary is ordered from the AUA Reader graded reader (bundled in
`cards.sealang.json`, sourced from [SEAlang](http://sealang.net/)) and merged
with the project's original hand-picked beginner words. See `DEVELOPMENT.md`
for how the list is built and how to regenerate it.
