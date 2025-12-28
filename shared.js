// shared.js — Shadow City game helpers

export const ROLES = {
  CITIZEN: "CITIZEN",
  KILLER: "KILLER",
  DETECTIVE: "DETECTIVE",
  DOCTOR: "DOCTOR",
};

export const ROLE_LABEL_TR = {
  CITIZEN: "Vatandaş",
  KILLER: "Katil",
  DETECTIVE: "Dedektif",
  DOCTOR: "Doktor",
};

export function nowMs() {
  return Date.now();
}

export function speakTR(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "tr-TR";
    u.rate = 0.95;
    u.pitch = 0.9;
    synth.cancel();
    synth.speak(u);
  } catch (_) {}
}

export function clampInt(x, min, max, fallback) {
  const n = Number.parseInt(x, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Role deck:
 * - killerCount kadar KILLER
 * - includeDetective => 1 detective
 * - includeDoctor => 1 doctor
 * geri kalan citizen
 */
export function makeRoleDeck(playerUids, settings) {
  const {
    killerCount = 1,
    includeDetective = true,
    includeDoctor = true,
  } = settings || {};

  const n = playerUids.length;
  const deck = [];

  for (let i = 0; i < killerCount; i++) deck.push(ROLES.KILLER);
  if (includeDetective) deck.push(ROLES.DETECTIVE);
  if (includeDoctor) deck.push(ROLES.DOCTOR);

  while (deck.length < n) deck.push(ROLES.CITIZEN);

  return shuffle(deck).slice(0, n);
}

/**
 * Alive lists
 */
export function aliveUids(playersObj) {
  return Object.entries(playersObj || {})
    .filter(([, p]) => p && p.alive === true && !p.isHost)
    .map(([uid]) => uid);
}

export function aliveCountByRole(playersObj, rolesByUid) {
  let killers = 0;
  let nonKillers = 0;
  for (const [uid, p] of Object.entries(playersObj || {})) {
    if (!p || p.isHost) continue;
    if (!p.alive) continue;
    const r = rolesByUid?.[uid]?.role;
    if (r === ROLES.KILLER) killers++;
    else nonKillers++;
  }
  return { killers, nonKillers, total: killers + nonKillers };
}

/**
 * Win check:
 * - killers === 0 => TOWN wins
 * - killers >= nonKillers => KILLERS win
 * else => continue
 */
export function computeWin(playersObj, rolesByUid) {
  const { killers, nonKillers } = aliveCountByRole(playersObj, rolesByUid);
  if (killers <= 0) return { ended: true, winner: "TOWN" };
  if (killers >= nonKillers) return { ended: true, winner: "KILLERS" };
  return { ended: false, winner: null };
}

/**
 * Majority of alive players (strict majority)
 */
export function strictMajority(nAlive) {
  return Math.floor(nAlive / 2) + 1;
}

export function pickMostVoted(votesObj) {
  // votesObj: { voterUid: targetUid|"SKIP" }
  const tally = new Map();
  for (const v of Object.values(votesObj || {})) {
    if (!v) continue;
    tally.set(v, (tally.get(v) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  let tie = false;

  for (const [k, c] of tally.entries()) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
      tie = false;
    } else if (c === bestCount) {
      tie = true;
    }
  }
  return { best, bestCount, tie };
}
