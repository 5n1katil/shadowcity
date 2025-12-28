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

export const ACTIONS = {
  SKIP_VOTE: "SKIP",
  NO_KILL: "NO_KILL",
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

export function nowMs(){ return Date.now(); }

export function clampInt(x, min, max, fallback){
  const n = Number.parseInt(x, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function shuffle(arr){
  const a = [...arr];
  for (let i=a.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

export function speakTR(text){
  try{
    const synth = window.speechSynthesis;
    if(!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang="tr-TR"; u.rate=0.95; u.pitch=0.95;
    synth.cancel(); synth.speak(u);
  }catch(_){}
}

export function strictMajority(nAlive){
  return Math.floor(nAlive/2)+1;
}

export function aliveUids(playersObj){
  return Object.entries(playersObj||{})
    .filter(([,p]) => p && !p.isHost && p.alive === true)
    .map(([uid]) => uid);
}

export function countAliveByRole(playersObj, rolesByUid){
  let killers=0, others=0;
  for (const [uid,p] of Object.entries(playersObj||{})){
    if(!p || p.isHost || !p.alive) continue;
    const r = rolesByUid?.[uid]?.role;
    if (r === ROLES.KILLER) killers++;
    else others++;
  }
  return { killers, others };
}

export function computeWin(playersObj, rolesByUid){
  const { killers, others } = countAliveByRole(playersObj, rolesByUid);
  if (killers <= 0) return { ended:true, winner:"TOWN" };
  if (killers >= others) return { ended:true, winner:"KILLERS" };
  return { ended:false, winner:null };
}

/**
 * settings:
 *  killerCount, includeDoctor, includeDetective
 */
export function makeRoleDeck(playerUids, settings){
  const n = playerUids.length;
  const deck = [];
  const kc = clampInt(settings?.killerCount ?? 1, 1, 6, 1);

  for (let i=0;i<kc;i++) deck.push(ROLES.KILLER);
  if (settings?.includeDoctor) deck.push(ROLES.DOCTOR);
  if (settings?.includeDetective) deck.push(ROLES.DETECTIVE);

  while (deck.length < n) deck.push(ROLES.CITIZEN);
  return shuffle(deck).slice(0,n);
}

export function pickMostVoted(votesObj){
  // votesObj: { voterUid: targetUid|"SKIP" }
  const tally = new Map();
  for (const v of Object.values(votesObj||{})){
    if (!v) continue;
    tally.set(v, (tally.get(v)||0)+1);
  }
  let best=null, bestCount=0, tie=false;
  for (const [k,c] of tally.entries()){
    if (c>bestCount){ best=k; bestCount=c; tie=false; }
    else if (c===bestCount){ tie=true; }
  }
  return { best, bestCount, tie };
}

/**
 * Night resolution (basit ve sağlam)
 * - killers: killMap {killerUid: targetUid|NO_KILL}
 * - doctor: protectMap {doctorUid: targetUid}
 * - detective: investigateMap (detective inbox ayrı yazılacak)
 */
export function resolveNight({playersObj, rolesByUid, killMap, protectMap, settings}){
  const alive = aliveUids(playersObj);
  const aliveSet = new Set(alive);

  // 1) Kill target tally (NO_KILL dahil değil)
  const tally = new Map();
  let anyNoKill = false;

  for (const t of Object.values(killMap||{})){
    if (!t) continue;
    if (t === ACTIONS.NO_KILL){ anyNoKill = true; continue; }
    if (!aliveSet.has(t)) continue;
    tally.set(t, (tally.get(t)||0)+1);
  }

  let killTarget=null, best=0, tie=false;
  for (const [t,c] of tally.entries()){
    if (c>best){ best=c; killTarget=t; tie=false; }
    else if (c===best){ tie=true; }
  }

  // tie => kill yok (veya allowNoKill açıksa kill yok gibi davranır)
  if (tie) killTarget = null;

  // allowNoKill ve katiller NO_KILL seçtiyse => kill yok
  if (settings?.allowNoKill && anyNoKill && !killTarget){
    killTarget = null;
  }

  // 2) Doctor protect (tek doktor varsayımı: ilk geçerli protect)
  let protectedUid = null;
  for (const t of Object.values(protectMap||{})){
    if (!t) continue;
    if (!aliveSet.has(t)) continue;
    protectedUid = t;
    break;
  }

  // 3) Apply
  if (!killTarget) return { diedUid:null, saved:false };

  if (protectedUid && protectedUid === killTarget){
    return { diedUid:null, saved:true };
  }

  return { diedUid: killTarget, saved:false };
}
