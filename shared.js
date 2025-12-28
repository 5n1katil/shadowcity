// shared.js — cross-screen game helpers for Shadow City

export const ROLES = {
  CITIZEN: "CITIZEN",
  KILLER: "KILLER",
  DETECTIVE: "DETECTIVE",
  DOCTOR: "DOCTOR",
};

// Special action values (DB'de string olarak saklanır)
export const ACTIONS = {
  SKIP_VOTE: "SKIP", // gündüz oylamasında pas
  NO_KILL: "NO_KILL", // gece katilin kimseyi öldürmemesi
};

export function nowMs() {
  return Date.now();
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
