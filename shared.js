// shared.js — Shadow City game helpers (v0.5)

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

// Special action values (DB'de string olarak saklanır)
export const ACTIONS = {
  SKIP_VOTE: "SKIP",     // gündüz oylamasında pas
  NO_KILL: "NO_KILL",    // gece katilin kimseyi öldürmemesi
};

export const DEFAULT_SETTINGS = {
  killerCount: 1,
  includeDetective: true,
  includeDoctor: true,

  // süreler (host ayarından gelecek)
  discussionSec: 120,
  nightSec: 45,
  voteSec: 45,

  // kurallar
  allowNoKill: true,                 // katil "NO_KILL" seçebilsin
  revealDeadRoleDuringGame: false,   // oyun bitmeden ölenin rolü açıklanmasın
  doctorSelfSaveMax: 1,              // doktor kendini en fazla kaç kez koruyabilir
};

export function mergeSettings(raw) {
  return { ...DEFAULT_SETTINGS, ...(raw || {}) };
}

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
export function makeRoleDeck(playerUids, rawSettings) {
  const settings = mergeSettings(rawSettings);
  const { killerCount, includeDetective, includeDoctor } = settings;

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
export function aliveUids(playersObj, { includeHost = false } = {}) {
  return Object.entries(playersObj || {})
    .filter(([, p]) => {
      if (!p) return false;
      if (!includeHost && p.isHost) return false;
      return p.alive === true;
    })
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

/**
 * votesObj: { voterUid: targetUid | "SKIP" }
 */
export function pickMostVoted(votesObj) {
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

/**
 * Night resolution helper (host tarafı için):
 * killerChoiceUid: target uid | "NO_KILL"
 * doctorSaveUid: target uid | null
 * doctorUid: doktorun uid'si (self-save limiti kontrolü için)
 * playersObj: players snapshot (alive flags vs.)
 * doctorState: { selfSaveUsed: number } gibi bir state'i host DB'de tutacak
 */
export function resolveNight({
  killerChoiceUid,
  doctorSaveUid,
  doctorUid,
  playersObj,
  doctorState,
  settings,
}) {
  const s = mergeSettings(settings);

  // 1) NO_KILL seçilmişse kimse ölmez
  if (s.allowNoKill && killerChoiceUid === ACTIONS.NO_KILL) {
    return { diedUid: null, saved: false, reason: "NO_KILL" };
  }

  // 2) hedef yoksa/yanlışsa kimse ölmesin
  if (!killerChoiceUid || !playersObj?.[killerChoiceUid]?.alive) {
    return { diedUid: null, saved: false, reason: "INVALID_TARGET" };
  }

  // 3) Doktor koruduysa ve hedef eşleşiyorsa kurtar
  if (doctorSaveUid && doctorSaveUid === killerChoiceUid) {
    // doktor kendini korumaya çalışıyorsa limit kontrolü burada yapılır
    if (doctorUid && doctorSaveUid === doctorUid) {
      const used = Number(doctorState?.selfSaveUsed || 0);
      if (used >= s.doctorSelfSaveMax) {
        // self-save hakkı bitti -> koruma geçersiz
        return { diedUid: killerChoiceUid, saved: false, reason: "SELF_SAVE_EXHAUSTED" };
      }
      // self-save geçerli (host burada selfSaveUsed artıracak)
      return { diedUid: null, saved: true, reason: "DOCTOR_SELF_SAVE" };
    }

    return { diedUid: null, saved: true, reason: "DOCTOR_SAVE" };
  }

  // 4) Doktor kurtarmadı -> hedef ölür
  return { diedUid: killerChoiceUid, saved: false, reason: "KILLED" };
}
