// shared.js — game logic (pure helpers)

export const ROLES = {
  CITIZEN: "CITIZEN",
  KILLER: "KILLER",
  DOCTOR: "DOCTOR",
  DETECTIVE: "DETECTIVE",
};

export const ROLE_TR = {
  CITIZEN: "Vatandaş",
  KILLER: "Katil",
  DOCTOR: "Doktor",
  DETECTIVE: "Dedektif",
};

export const PHASE = {
  WAITING: "waiting",
  DISCUSSION: "discussion",
  VOTING: "voting",

  NIGHT_KILL: "night_kill",
  NIGHT_DOCTOR: "night_doctor",
  NIGHT_DETECTIVE: "night_detective",

  MORNING: "morning",
  ENDED: "ended",
};

export const ACTIONS = {
  SKIP_VOTE: "SKIP",
};

export const DEFAULT_SETTINGS = {
  killerCount: 1,
  includeDoctor: false,
  includeDetective: false,

  discussionSec: 300, // 5 dk
  voteSec: 60,

  doctorSelfSaveMax: 1,
};

export function mergeSettings(s) {
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
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

// host hariç hayatta olan UID’ler
export function aliveUids(playersObj) {
  return Object.entries(playersObj || {})
    .filter(([, p]) => p && !p.isHost && p.alive === true)
    .map(([uid]) => uid);
}

export function strictMajority(nAlive) {
  return Math.floor(nAlive / 2) + 1;
}

export function makeRoleDeck(aliveUidsArr, settings) {
  const s = mergeSettings(settings);
  const n = aliveUidsArr.length;

  const deck = [];
  for (let i = 0; i < s.killerCount; i++) deck.push(ROLES.KILLER);
  if (s.includeDoctor) deck.push(ROLES.DOCTOR);
  if (s.includeDetective) deck.push(ROLES.DETECTIVE);

  while (deck.length < n) deck.push(ROLES.CITIZEN);
  return shuffle(deck).slice(0, n);
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
  return { killers, nonKillers };
}

export function computeWin(playersObj, rolesByUid) {
  const { killers, nonKillers } = aliveCountByRole(playersObj, rolesByUid);
  if (killers <= 0) return { ended: true, winner: "TOWN" };
  if (killers >= nonKillers) return { ended: true, winner: "KILLERS" };
  return { ended: false, winner: null };
}

export function tallyMost(votesObj) {
  // votesObj: { voterUid: targetUid|string }
  const map = new Map();
  for (const v of Object.values(votesObj || {})) {
    if (!v) continue;
    map.set(v, (map.get(v) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  let tie = false;

  for (const [k, c] of map.entries()) {
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

export function speakTR(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "tr-TR";
    u.rate = 0.95;
    u.pitch = 0.95;
    synth.cancel();
    synth.speak(u);
  } catch {}
}

export function resolveNight({
  killTargetUid, // uid | null
  doctorSaveUid, // uid | null
  doctorUid, // uid | null
  doctorSelfUsed, // number
  settings,
}) {
  const s = mergeSettings(settings);

  if (!killTargetUid) {
    return { diedUid: null, saved: false, reason: "NO_KILL" };
  }

  // doktor koruduysa kurtuldu
  if (doctorSaveUid && doctorSaveUid === killTargetUid) {
    // self-save ise limit kontrolü hostta yapılır; burada sadece reason
    if (doctorUid && doctorUid === doctorSaveUid) {
      return { diedUid: null, saved: true, reason: "DOCTOR_SELF_SAVE" };
    }
    return { diedUid: null, saved: true, reason: "DOCTOR_SAVE" };
  }

  return { diedUid: killTargetUid, saved: false, reason: "KILLED" };
}
