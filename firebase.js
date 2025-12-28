// firebase.js (CDN, modular v9)
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
  onDisconnect,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// --- CONFIG (senin projenden) ---
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

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// --- Auth ---
let authReady = null;
export function ensureAuth(){
  if (authReady) return authReady;
  authReady = new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try{
        if (user){ unsub(); resolve(user); return; }
        const cred = await signInAnonymously(auth);
        unsub();
        resolve(cred.user);
      }catch(e){ reject(e); }
    });
  });
  return authReady;
}

// --- Helpers ---
export function listen(r, cb){
  const off = onValue(r, (snap) => cb(snap.exists()? snap.val() : null));
  return off;
}

export function roomRef(code){ return ref(db, `rooms/${code}`); }
export function settingsRef(code){ return ref(db, `rooms/${code}/settings`); }
export function stateRef(code){ return ref(db, `rooms/${code}/state`); }
export function playersRef(code){ return ref(db, `rooms/${code}/players`); }
export function playerRef(code, uid){ return ref(db, `rooms/${code}/players/${uid}`); }
export function secretRoleRef(code, uid){ return ref(db, `rooms/${code}/secret/roles/${uid}`); }

export function requestsVoteRef(code){ return ref(db, `rooms/${code}/requests/voteStart`); }
export function requestVoteMeRef(code, uid){ return ref(db, `rooms/${code}/requests/voteStart/${uid}`); }
export function requestsFastNightRef(code){ return ref(db, `rooms/${code}/requests/fastNight`); }
export function requestFastNightMeRef(code, uid){ return ref(db, `rooms/${code}/requests/fastNight/${uid}`); }

export function votingVotesRef(code){ return ref(db, `rooms/${code}/voting/votes`); }
export function votingVoteMeRef(code, uid){ return ref(db, `rooms/${code}/voting/votes/${uid}`); }

export function nightActionsKillRef(code){ return ref(db, `rooms/${code}/night/actions/kill`); }
export function nightActionsProtectRef(code){ return ref(db, `rooms/${code}/night/actions/protect`); }
export function nightActionsInvestigateRef(code){ return ref(db, `rooms/${code}/night/actions/investigate`); }

export function nightActionMeRef(code, kind, uid){
  return ref(db, `rooms/${code}/night/actions/${kind}/${uid}`);
}

export function generateRoomCode(len=6){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s="";
  for(let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

// Join functions
export async function joinRoomAsHost(code, hostName){
  const user = await ensureAuth();
  await set(playerRef(code, user.uid), {
    name: hostName || "HOST",
    isHost: true,
    alive: false,
    joinedAt: Date.now()
  });
  return user;
}

export async function joinRoomAsPlayer(code, playerName){
  const user = await ensureAuth();
  await set(playerRef(code, user.uid), {
    name: playerName || "Player",
    isHost: false,
    alive: true,
    doctorSelfProtectUsed: 0,
    joinedAt: Date.now()
  });
  return user;
}

// Export core db funcs you already use
export { ref, get, set, update, onDisconnect };
