/* app.js — adaptive sight-word drill engine.
 *
 * Model (see DEVELOPMENT.md):
 *   - MASTER (words.js) is one difficulty-ordered list of [word, level].
 *   - `frontier` is how far down that list the learner has unlocked.
 *   - Each word has a Leitner `box` (0..MAX_BOX); box >= MASTERED_BOX = learned.
 *   - When the active pool is mostly mastered, the next BATCH is unlocked.
 *   - A sitting is SESSION_LEN cards, then a short celebration screen.
 *   - Mastered words unseen for DECAY_DAYS drop one box so they resurface.
 * There are no fixed/themed decks: every sitting is generated from state.
 */
"use strict";

/* ---------------- tuning knobs ---------------- */
const START_POOL   = 15;   // words unlocked at the very start (~chapter 1)
const SESSION_LEN  = 20;    // cards per sitting
const BATCH        = 5;     // new words unlocked when the pool is ready
const MASTERED_BOX = 4;     // box at/above this counts as "learned"
const MAX_BOX      = 5;
const ADVANCE_FRAC = 0.8;   // fraction of pool mastered before unlocking more
const DECAY_DAYS   = 7;     // mastered word unseen this long drops one box

const LS_STATE   = "thaiFlash.state.v3";
const LS_WEIGHTS = "thaiFlash.weights.v1"; // legacy v1, for one-time migration

/* ---------------- derived from MASTER ---------------- */
const WORDS = MASTER.map(m => m[0]);
const LEVEL = {};
MASTER.forEach(m => { LEVEL[m[0]] = m[1]; });

/* ---------------- runtime state ---------------- */
let cards = {};            // word -> { box, seen, correct, last }
let frontier = START_POOL;
let currentWord = null;
let sessionCount = 0, sessionCorrect = 0;

function blankCard() { return { box: 0, seen: 0, correct: 0, last: 0 }; }

/* ---------------- persistence ---------------- */
function loadState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(LS_STATE)); } catch { s = null; }
  if (s && s.cards) {
    cards = s.cards;
    frontier = s.frontier || START_POOL;
  } else {
    migrateFromWeights();
  }
  ensureActiveCards();
  applyDecay();
}

function saveState() {
  try { localStorage.setItem(LS_STATE, JSON.stringify({ cards, frontier })); } catch {}
}

function ensureActiveCards() {
  const n = Math.min(frontier, WORDS.length);
  for (let i = 0; i < n; i++) if (!cards[WORDS[i]]) cards[WORDS[i]] = blankCard();
}

/* One-time migration: legacy frequency weights -> boxes + unlocked frontier. */
function migrateFromWeights() {
  let old = null;
  try { old = JSON.parse(localStorage.getItem(LS_WEIGHTS)); } catch { old = null; }
  cards = {};
  frontier = START_POOL;
  if (!old) return;
  // Preserve mastery for every previously-seen word (even ones that now sit
  // deep in the difficulty order), but unlock a pool sized to how many words
  // were practiced, drawn from the easy end — don't let one deep word unlock
  // the whole early range.
  let migrated = 0;
  WORDS.forEach((w) => {
    const v = old[w];
    if (typeof v === "number" && isFinite(v)) {
      cards[w] = { box: weightToBox(v), seen: 1, correct: 0, last: Date.now() };
      migrated++;
    }
  });
  frontier = Math.min(WORDS.length, Math.max(START_POOL, migrated));
}

/* Low legacy weight meant "answered correctly often" -> high box. */
function weightToBox(w) {
  if (w <= 0.2) return 4;
  if (w <= 0.4) return 3;
  if (w <= 0.75) return 2;
  if (w <= 1.5) return 1;
  return 0;
}

/* A mastered word unseen for > DECAY_DAYS drops one box so it comes back. */
function applyDecay() {
  const now = Date.now();
  const ms = DECAY_DAYS * 86400000;
  for (const w in cards) {
    const c = cards[w];
    if (c.box >= MASTERED_BOX && c.last && (now - c.last) > ms) c.box = MASTERED_BOX - 1;
  }
}

/* ---------------- selection + progression ---------------- */
function activeWords() { return WORDS.slice(0, Math.min(frontier, WORDS.length)); }

function masteredCount(list) {
  let n = 0;
  for (const w of list) if (cards[w] && cards[w].box >= MASTERED_BOX) n++;
  return n;
}

function maxLevelReached() {
  let lv = 1;
  for (const w of activeWords()) lv = Math.max(lv, LEVEL[w] || 1);
  return lv;
}

/* Unlock the next BATCH once the active pool is mostly mastered. */
function maybeAdvance() {
  if (frontier >= WORDS.length) return;
  const list = activeWords();
  if (list.length === 0) return;
  if (masteredCount(list) / list.length >= ADVANCE_FRAC) {
    frontier = Math.min(WORDS.length, frontier + BATCH);
    ensureActiveCards();
  }
}

/* Weight: struggling + brand-new words shown most, mastered occasionally. */
function cardWeight(w) {
  const c = cards[w] || blankCard();
  let x = (MAX_BOX + 1 - c.box);
  if (c.box >= MASTERED_BOX) x *= 0.3;
  if (c.seen === 0) x *= 1.6;
  return x;
}

function pickWord() {
  const list = activeWords();
  let total = 0;
  for (const w of list) { if (w === currentWord && list.length > 1) continue; total += cardWeight(w); }
  let r = Math.random() * total;
  for (const w of list) {
    if (w === currentWord && list.length > 1) continue;
    r -= cardWeight(w);
    if (r <= 0) return w;
  }
  return list[list.length - 1];
}

/* ---------------- DOM ---------------- */
const cardEl   = document.getElementById("card");
const wordEl   = document.getElementById("word");
const statsEl  = document.getElementById("stats");
const overlay  = document.getElementById("overlay");
const sessStat = document.getElementById("sessionStat");

function fitWord() {
  const maxW = cardEl.clientWidth  * 0.94;
  const maxH = cardEl.clientHeight * 0.80;
  let size = Math.min(cardEl.clientHeight * 0.72, cardEl.clientWidth * 0.9);
  wordEl.style.fontSize = size + "px";
  let guard = 60;
  while ((wordEl.scrollWidth > maxW || wordEl.scrollHeight > maxH) && size > 24 && guard-- > 0) {
    size *= 0.92;
    wordEl.style.fontSize = size + "px";
  }
}

function renderStats() {
  const list = activeWords();
  statsEl.innerHTML =
    `บทที่ ≤<b>${maxLevelReached()}</b> · รู้แล้ว <b>${masteredCount(list)}/${list.length}</b> ⭐`;
}

function nextWord() {
  currentWord = pickWord();
  wordEl.textContent = currentWord || "—";
  fitWord();
  renderStats();
}

function flash(kind) {
  cardEl.classList.remove("flash-correct", "flash-wrong");
  void cardEl.offsetWidth;
  cardEl.classList.add(kind === "correct" ? "flash-correct" : "flash-wrong");
}

/* ---------------- session flow ---------------- */
function startSession() {
  applyDecay();
  maybeAdvance();
  saveState();
  sessionCount = 0; sessionCorrect = 0;
  overlay.classList.add("hidden");
  nextWord();
}

function endSession() {
  const pct = sessionCount ? Math.round((sessionCorrect / sessionCount) * 100) : 0;
  const list = activeWords();
  sessStat.innerHTML =
    `ทำได้ <b>${sessionCount}</b> คำ · ถูก <b>${pct}%</b><br>` +
    `รู้แล้วทั้งหมด <b>${masteredCount(list)}/${list.length}</b> ⭐`;
  overlay.classList.remove("hidden");
}

function answer(isCorrect) {
  if (!currentWord || !overlay.classList.contains("hidden")) return;
  const c = cards[currentWord] || (cards[currentWord] = blankCard());
  c.seen++;
  if (isCorrect) { c.correct++; c.box = Math.min(MAX_BOX, c.box + 1); }
  else           { c.box = Math.max(0, c.box - 1); }
  c.last = Date.now();
  saveState();
  sessionCount++;
  if (isCorrect) sessionCorrect++;
  flash(isCorrect ? "correct" : "wrong");
  if (sessionCount >= SESSION_LEN) endSession();
  else nextWord();
}

/* Tap the word to skip without scoring (does not count toward the session). */
function skip() {
  if (!overlay.classList.contains("hidden")) return;
  nextWord();
}

function resetAll() {
  if (!confirm("เริ่มใหม่ทั้งหมด? ลบความคืบหน้าทั้งหมด\nReset ALL progress?")) return;
  cards = {};
  frontier = START_POOL;
  ensureActiveCards();
  saveState();
  startSession();
}

/* ---------------- wiring ---------------- */
document.getElementById("correct").addEventListener("click", () => answer(true));
document.getElementById("wrong").addEventListener("click", () => answer(false));
document.getElementById("resetBtn").addEventListener("click", resetAll);
document.getElementById("continueBtn").addEventListener("click", startSession);
cardEl.addEventListener("click", skip);

window.addEventListener("keydown", (e) => {
  if (!overlay.classList.contains("hidden")) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startSession(); }
    return;
  }
  if (e.key === "ArrowRight") answer(true);
  else if (e.key === "ArrowLeft") answer(false);
  else if (e.key === " ") { e.preventDefault(); skip(); }
});

window.addEventListener("resize", fitWord);
window.addEventListener("orientationchange", () => setTimeout(fitWord, 200));

/* ---------------- init ---------------- */
loadState();
saveState();
startSession();
