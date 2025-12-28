// firebase.js — Shadow City v0.4 (GitHub Pages + Secure Rules uyumlu)

// 🔹 Firebase CDN imports (npm DEĞİL)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  push,
  onValue,
  off,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// 🔐 SENİN PROJENİN FIREBASE CONFIG'I
const firebaseConfig = {
  apiKey: "AIzaSyA2AKJHdcamzFNgUZBbiKPJL8hUG1pNVRI",
  authDomain: "shadowcity-58430.firebaseapp.com",
  databaseURL: "https://shadowcity-58430-default-rtdb.firebaseio.com",
  projectId: "shadowcity-58430",
  storageBucket: "shadowcity-58430.firebasestorage.app",
  messagingSenderId: "996924150050",
  appId: "1:996924150050:web:9c7a4ee9b7418c4f26157b",
  measurementId: "G-16ZY5Z593E"
};

// 🔧 Init
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export { ref, get, set, update, push, onValue, off, onDisconnect };

/**
 * 🔑 Anonymous Auth (zorunlu)
 */
export function ensureAuth() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          await signInAnonymously(auth);
          return;
        }
        unsub();
        resolve(user);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * 📌 Refs
 */
export const roomRef = (roomCode) => ref(db, `rooms/${roomCode}`);
export const playersRef = (roomCode) => ref(db, `rooms/${roomCode}/players`);
export const playerRef = (roomCode, uid) => ref(db, `rooms/${roomCode}/players/${uid}`);
export const settingsRef = (roomCode) => ref(db, `rooms/${roomCode}/settings`);
export const stateRef = (roomCode) => ref(db, `rooms/${roomCode}/state`);
export const myRoleRef = (roomCode, uid) => ref(db, `rooms/${roomCode}/secret/roles/${uid}`);
export const voteCallRequestsRef = (roomCode) => ref(db, `rooms/${roomCode}/day/voteCall/requests`);
export const votingVotesRef = (roomCode) => ref(db, `rooms/${roomCode}/voting/votes`);
export const nightActionsRef = (roomCode) => ref(db, `rooms/${roomCode}/night/actions`);
export const nightResultsRef = (roomCode) => ref(db, `rooms/${roomCode}/night/results`);
export const logRef = (roomCode) => ref(db, `rooms/${roomCode}/log/events`);

/**
 * 👂 Listener helper
 */
export function listen(r, cb) {
  return onValue(r, (snap) => cb(snap.val()));
}

/**
 * 🧍 Oyuncu olarak odaya katıl
 */
export async function joinRoomAsPlayer(roomCode, name) {
  await ensureAuth();
  const uid = auth.currentUser.uid;

  await set(playerRef(roomCode, uid), {
    name: String(name || "Player").slice(0, 20),
    alive: true,
    joinedAt: Date.now(),
    doctorSelfProtectUsed: 0
  });

  return uid;
}

/**
 * 🎥 Host olarak odaya katıl
 * ⚠️ Çok kritik: rules gereği host da players altında olmalı
 */
export async function joinRoomAsHost(roomCode, hostName = "HOST") {
  await ensureAuth();
  const uid = auth.currentUser.uid;

  await set(playerRef(roomCode, uid), {
    name: hostName,
    alive: false,
    joinedAt: Date.now(),
    isHost: true
  });

  return uid;
}

/**
 * 🏷️ Room code üret
 */
export function generateRoomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * 📝 Log (host kullanır)
 */
export async function logEvent(roomCode, type, text) {
  const e = push(logRef(roomCode));
  await set(e, {
    t: Date.now(),
    type,
    text
  });
}
