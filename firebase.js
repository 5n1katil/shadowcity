// firebase.js — Shadow City (CDN / Firebase v9 modular)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onValue,
  off,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// ✅ Senin Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA2AKJHdcamzFNgUZBbiKPJL8hUG1pNVRI",
  authDomain: "shadowcity-58430.firebaseapp.com",
  databaseURL: "https://shadowcity-58430-default-rtdb.firebaseio.com",
  projectId: "shadowcity-58430",
  storageBucket: "shadowcity-58430.firebasestorage.app",
  messagingSenderId: "996924150050",
  appId: "1:996924150050:web:9c7a4ee9b7418c4f26157b",
  measurementId: "G-16ZY5Z593E",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// ---------- Auth ----------
let authReadyPromise = null;

export async function ensureAuth() {
  if (auth.currentUser) return auth.currentUser;

  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve, reject) => {
      const unsub = onAuthStateChanged(auth, (u) => {
        if (u) {
          unsub();
          resolve(u);
        }
      });

      signInAnonymously(auth).catch((e) => {
        try {
          unsub();
        } catch {}
        reject(e);
      });
    });
  }
  return authReadyPromise;
}

// ---------- Utilities ----------
export function nowMs() {
  return Date.now();
}

export function generateRoomCode(len = 6) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function listen(r, cb) {
  const handler = (snap) => cb(snap.val());
  onValue(r, handler);
  return () => off(r, "value", handler);
}

// ---------- Refs ----------
export const roomRef = (code) => ref(db, `rooms/${code}`);
export const settingsRef = (code) => ref(db, `rooms/${code}/settings`);
export const stateRef = (code) => ref(db, `rooms/${code}/state`);
export const playersRef = (code) => ref(db, `rooms/${code}/players`);
export const playerRef = (code, uid) => ref(db, `rooms/${code}/players/${uid}`);

export const secretRoleRef = (code, uid) => ref(db, `rooms/${code}/secret/roles/${uid}`);
export const secretRolesRef = (code) => ref(db, `rooms/${code}/secret/roles`);

export const votingVotesRef = (code) => ref(db, `rooms/${code}/voting/votes`);
export const votingVoteMeRef = (code, uid) => ref(db, `rooms/${code}/voting/votes/${uid}`);

export const nightActionsRef = (code) => ref(db, `rooms/${code}/night/actions`);
export const nightActionMeRef = (code, kind, uid) =>
  ref(db, `rooms/${code}/night/actions/${kind}/${uid}`);

export const nightResultsRef = (code) => ref(db, `rooms/${code}/night/results`);

export const requestsRef = (code) => ref(db, `rooms/${code}/day`);
export const requestVoteStartRef = (code) => ref(db, `rooms/${code}/day/voteCall/requests`);
export const requestVoteStartMeRef = (code, uid) =>
  ref(db, `rooms/${code}/day/voteCall/requests/${uid}`);

export const requestFastNightRef = (code) => ref(db, `rooms/${code}/day/fastNight/requests`);
export const requestFastNightMeRef = (code, uid) =>
  ref(db, `rooms/${code}/day/fastNight/requests/${uid}`);

export const hostHeartbeatRef = (code) => ref(db, `rooms/${code}/host/heartbeat`);
export const hostUidRef = (code) => ref(db, `rooms/${code}/host/uid`);

// ---------- Join helpers ----------
export async function joinRoomAsHost(code, hostName = "HOST") {
  const u = await ensureAuth();
  // host da players altında olmalı (rules için)
  await update(playerRef(code, u.uid), {
    name: hostName,
    isHost: true,
    alive: true,
    joinedAt: nowMs(),
  });
  // host kimliği
  await set(hostUidRef(code), u.uid);
  return u;
}

export async function joinRoomAsPlayer(code, name) {
  const u = await ensureAuth();
  await update(playerRef(code, u.uid), {
    name,
    isHost: false,
    alive: true,
    joinedAt: nowMs(),
    doctorSelfProtectUsed: 0,
  });
  return u;
}

// Re-export db ops (host/player html rahat kullansın)
export { ref, get, set, update, serverTimestamp };
