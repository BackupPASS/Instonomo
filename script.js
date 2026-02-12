import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import { createEngine } from "./core/engine.js";

const firebaseConfig = {
  apiKey: "AIzaSyASVwoxjL0ZHSF6kOIxGOMks1A-9NllUMw",
  authDomain: "plingifyplug.firebaseapp.com",
  projectId: "plingifyplug",
  storageBucket: "plingifyplug.firebasestorage.app",
  messagingSenderId: "198551817496",
  appId: "1:198551817496:web:e7d84490321637448a226d",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const engine = createEngine();

const chatOutput = document.getElementById("chat-output");
const textInput = document.getElementById("text-input");
const micButton = document.getElementById("mic-button");
const muteButton = document.getElementById("mute-button");
const enterButton = document.getElementById("enter-button");

const welcomeScreen = document.getElementById("welcome-screen");
const closeWelcomeButton = document.getElementById("close-welcome");
const loadingScreen = document.getElementById("loading-screen");
const termsScreen = document.getElementById("terms-screen");
const acceptTermsBtn = document.getElementById("accept-terms");

const TERMS_COOKIE = "instonomo_terms_accepted"

const clearChatbotBtn = document.getElementById("clear-chatbot-btn");
const chatOutputAI = document.getElementById("chat-output-ai");
const textInputAI = document.getElementById("text-input-ai");
const micButtonAI = document.getElementById("mic-button-ai");
const muteButtonAI = document.getElementById("mute-button-ai");
const enterButtonAI = document.getElementById("enter-button-ai");
const clearAIBtn = document.getElementById("clear-ai-btn");

let isRecording = false;
let recognition;
let recognitionAI;

let isMuted = sessionStorage.getItem("isMuted") === "true" || false;
let isMutedAI = sessionStorage.getItem("isMutedAI") === "true" || false;


const userProfile = {
  name: localStorage.getItem("instonomo_name") || null,
  mood: null,
  lastTopic: null,
};

let cachedVoices = [];
if ("speechSynthesis" in window) {
  const loadVoices = () => {
    cachedVoices = speechSynthesis.getVoices();
  };
  loadVoices();
  if (typeof speechSynthesis.onvoiceschanged !== "undefined") {
    speechSynthesis.onvoiceschanged = loadVoices;
  }
}

function generateDeviceId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "dev-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
}

function getFromAnyStorage(key) {
  try {
    const fromLocal = localStorage.getItem(key);
    if (fromLocal) return fromLocal;
  } catch (e) {}
  try {
    const fromSession = sessionStorage.getItem(key);
    if (fromSession) return fromSession;
  } catch (e) {}
  try {
    const fromCookie = getCookie(key);
    if (fromCookie) return fromCookie;
  } catch (e) {}
  return null;
}

function setInAllStorages(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
  try {
    sessionStorage.setItem(key, value);
  } catch (e) {}
  try {
    setCookie(key, value, 365);
  } catch (e) {}
}

function getOrCreateDeviceId() {
  let id = getFromAnyStorage("instonomo_device_id");
  if (!id) {
    id = generateDeviceId();
  }
  setInAllStorages("instonomo_device_id", id);
  return id;
}

const deviceId = getOrCreateDeviceId();

const ABUSE_PATTERNS = [
  {
    tag: "racism",
    words: ["nigger", "coon", "paki", "chink", "spic"],
  },
  {
    tag: "sexual",
    words: ["whore", "slag", "slut"],
  },
  {
    tag: "insult",
    words: [
      "fuck",
      "shit",
      "bitch",
      "cunt",
      "twat",
      "wanker",
      "bastard",
      "dickhead",
      "prick",
      "idiot",
      "moron",
      "retard",
      "loser",
    ],
  },
  {
    tag: "self-harm",
    words: ["kill your self", "kill yourself", "kys", "go die"],
  },
  {
    tag: "spam",
    words: ["free money", "click here", "visit this link", "win a prize", "claim your reward"],
  },
];

const MAX_WARNINGS_BEFORE_FINAL = 2;
const BAN_AFTER_STRIKE = 4;

function getAbuseTags(normalizedInput) {
  if (!normalizedInput) return [];
  const tags = new Set();

  for (const pattern of ABUSE_PATTERNS) {
    for (const word of pattern.words) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      if (regex.test(normalizedInput)) {
        tags.add(pattern.tag);
        break;
      }
    }
  }

  const urlMatches = normalizedInput.match(/https?:\/\/[^\s]+/gi);
  if (urlMatches && urlMatches.length >= 3) {
    tags.add("spam");
  }

  return Array.from(tags);
}

function messageHasAbuse(normalizedInput) {
  return getAbuseTags(normalizedInput).length > 0;
}

async function fetchDeviceState() {
  try {
    const ref = doc(db, "instonomo_devices", deviceId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { banned: false, strikes: 0 };
    }
    const data = snap.data() || {};
    return {
      banned: !!data.banned,
      strikes: typeof data.strikes === "number" ? data.strikes : 0,
    };
  } catch (e) {
    console.warn("Failed to fetch device state from Firestore:", e);
    return { banned: false, strikes: 0 };
  }
}

async function updateDeviceState(banned, strikes, lastTags = []) {
  try {
    const ref = doc(db, "instonomo_devices", deviceId);
    await setDoc(
      ref,
      {
        deviceId,
        banned: !!banned,
        strikes: typeof strikes === "number" ? strikes : 0,
        lastTags: Array.isArray(lastTags) ? lastTags : [],
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("Failed to update device state in Firestore:", e);
  }
}

async function logAbuseMessage(originalInput, normalizedInput, strikes, willBan, tags) {
  try {
    const deviceRef = doc(db, "instonomo_devices", deviceId);
    const logsCol = collection(deviceRef, "abuseLogs");
    await addDoc(logsCol, {
      deviceId,
      text: originalInput,
      normalized: normalizedInput,
      strikes: strikes,
      bannedAfterThis: !!willBan,
      tags: Array.isArray(tags) ? tags : [],
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn("Failed to log abuse message to Firestore:", e);
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTs(ts) {
  try {
    if (ts && typeof ts.toDate === "function") return ts.toDate().toLocaleString();
  } catch (e) {}
  return "Unknown";
}

async function fetchRecentAbuseLogs(max = 5) {
  try {
    const deviceRef = doc(db, "instonomo_devices", deviceId);
    const logsRef = collection(deviceRef, "abuseLogs");
    const q = query(logsRef, orderBy("createdAt", "desc"), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() || {});
  } catch (e) {
    console.warn("Failed to fetch abuse logs:", e);
    return [];
  }
}

function statusLabel(code) {
  const c = String(code || "").toLowerCase();
  if (c === "under_review") return "Under Review";
  if (c === "denied") return "Appeal Denied";
  if (c === "approved") return "Appeal Approved";
  return "No Appeal Submitted";
}

async function submitBanAppeal(email, reason, deviceState, recentLogs) {
  const cleanEmail = String(email || "").trim();
  const cleanReason = String(reason || "").trim();

  const appealDocRef = doc(db, "instonomo_appeals", deviceId);

  await setDoc(appealDocRef, {
    deviceId,
    lastSubmittedAt: serverTimestamp(),
    lastEmail: cleanEmail,
    lastReason: cleanReason,
    strikes: typeof deviceState?.strikes === "number" ? deviceState.strikes : 0,
    banned: !!deviceState?.banned,
    lastTags: Array.isArray(deviceState?.lastTags) ? deviceState.lastTags : [],
    status: "open"
  }, { merge: true });

  const submissionsRef = collection(appealDocRef, "submissions");
  await addDoc(submissionsRef, {
    deviceId,
    email: cleanEmail,
    reason: cleanReason,

    strikes: typeof deviceState?.strikes === "number" ? deviceState.strikes : 0,
    banned: !!deviceState?.banned,
    lastTags: Array.isArray(deviceState?.lastTags) ? deviceState.lastTags : [],

    recentAbuse: Array.isArray(recentLogs)
      ? recentLogs.map(l => ({
          text: String(l.text || ""),
          normalized: String(l.normalized || ""),
          tags: Array.isArray(l.tags) ? l.tags : [],
          createdAt: l.createdAt || null
        }))
      : [],

    createdAt: serverTimestamp(),
    status: "open"
  });

  const deviceRef = doc(db, "instonomo_devices", deviceId);
  await setDoc(deviceRef, {
    appealStatus: "under_review",
    appealStatusText: "Under Review",
    appealUpdatedAt: serverTimestamp()
  }, { merge: true });
}

function showDeviceBannedScreen() {
  document.body.innerHTML =
    "PlingifyPlug AntiMalware has decided to ban this device.<br><br>Loading ban details…";

  document.body.style =
    "margin:20px;font-family:system-ui, sans-serif;background:#ffffff;color:#000000;";
  document.documentElement.style = "margin:0;padding:0;background:#ffffff;";

  (async () => {
    const state = await fetchDeviceState();

    let bannedAt = null;
    let appealStatus = "none";
    let appealStatusText = "";
    let lastTags = [];

    try {
      const ref = doc(db, "instonomo_devices", deviceId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() || {};
        bannedAt = data.bannedAt || null;
        appealStatus = data.appealStatus || "none";
        appealStatusText = data.appealStatusText || "";
        lastTags = Array.isArray(data.lastTags) ? data.lastTags : [];
      }
    } catch (e) {}

    const recentLogs = await fetchRecentAbuseLogs(5);

    const shownStatus = String(appealStatusText || "").trim()
      ? String(appealStatusText).trim()
      : statusLabel(appealStatus);

    let logsHtml = "<b>Recent messages that triggered the policy:</b><br>";
    if (!recentLogs.length) {
      logsHtml += "No recent log entries could be loaded.<br><br>";
    } else {
      logsHtml += "<ul>";
      for (const l of recentLogs) {
        logsHtml += `<li>${escapeHtml(l.text || "(no text)")}</li>`;
      }
      logsHtml += "</ul><br>";
    }

    document.body.innerHTML =
      "<b>Device banned</b><br><br>" +
      `<b>Device ID:</b><br>${escapeHtml(deviceId)}<br><br>` +
      `<b>Banned at:</b> ${escapeHtml(formatTs(bannedAt))}<br>` +
      `<b>Strikes:</b> ${escapeHtml(state.strikes)}<br>` +
      `<b>Last detected categories:</b> ${escapeHtml(lastTags.join(", ") || "None recorded")}<br>` +
      `<b>Appeal status:</b> <span id="appeal-current-status">${escapeHtml(shownStatus)}</span><br><br>` +
      logsHtml +
      "<b>Appeal this ban</b><br>" +
      "If you believe this was a mistake, submit an appeal below.<br><br>" +
      "<label>Email<br><input id='appeal-email' type='email' placeholder='you@example.com'></label><br><br>" +
      "<label>Reason<br><textarea id='appeal-reason' rows='6' placeholder='Explain what happened'></textarea></label><br><br>" +
      "<button id='appeal-submit'>Submit appeal</button>" +
      "<div id='appeal-status'></div>";

    const btn = document.getElementById("appeal-submit");
    const statusEl = document.getElementById("appeal-status");
    const statusTextEl = document.getElementById("appeal-current-status");

    btn.addEventListener("click", async () => {
      const email = (document.getElementById("appeal-email").value || "").trim();
      const reason = (document.getElementById("appeal-reason").value || "").trim();

      if (!email || !email.includes("@")) {
        statusEl.innerHTML = "<br>❌ Please enter a valid email address.";
        return;
      }
      if (!reason || reason.length < 10) {
        statusEl.innerHTML = "<br>❌ Please explain your reason (at least 10 characters).";
        return;
      }

      btn.disabled = true;
      statusEl.innerHTML = "<br>Submitting…";

      try {
        await submitBanAppeal(email, reason, {
          banned: true,
          strikes: state.strikes,
          lastTags
        }, recentLogs);

        statusTextEl.textContent = "Under Review";
        statusEl.innerHTML = "<br>✅ Appeal submitted.";
      } catch (e) {
        console.warn(e);
        statusEl.innerHTML = "<br>❌ Could not submit appeal. Try again later.";
        btn.disabled = false;
      }
    });
  })();
}

async function enforceAbusePolicy(originalInput, normalizedInput) {
  let { banned, strikes } = await fetchDeviceState();

  if (banned) {
    showDeviceBannedScreen();
    return { blocked: true, message: null };
  }

  const tags = getAbuseTags(normalizedInput);
  if (!tags.length) {
    return { blocked: false, message: null };
  }

  strikes = (strikes || 0) + 1;
  let message = null;
  let willBan = false;

  if (strikes <= MAX_WARNINGS_BEFORE_FINAL) {
    message = `Please don’t use rude or offensive language. This is warning ${strikes} of 3.`;
  } else if (strikes === MAX_WARNINGS_BEFORE_FINAL + 1) {
    message =
      "This is your final warning. One more offensive message and this device will be banned from Instonomo on this site.";
  } else if (strikes >= BAN_AFTER_STRIKE) {
    banned = true;
    willBan = true;
  }

  await logAbuseMessage(originalInput, normalizedInput, strikes, willBan, tags);
  await updateDeviceState(banned, strikes, tags);

  if (banned && willBan) {
    const ref = doc(db, "instonomo_devices", deviceId);
    await setDoc(ref, {
      bannedAt: serverTimestamp(),
      appealStatus: "none",
      appealStatusText: "No Appeal Submitted",
      appealUpdatedAt: serverTimestamp()
    }, { merge: true });

    showDeviceBannedScreen();
    return { blocked: true, message: null };
  }

  return { blocked: true, message };
}


const preDefinedResponses = {
  yo: "Hey! What’s up?",
  hey: "Hey there! 👋",
  hi: "Hiya! How can I help?",
  hello: "Hello there!",
  "good morning": "Good morning! ☀️",
  "good afternoon": "Good afternoon! How’s your day going?",
  "good evening": "Good evening! Need anything?",
  "good night": "Good night! Sleep well 🌙",
  hiya: "Hey hey!",
  sup: "Not much, you?",
  "how are you": "I'm doing great, thanks! How about you?",
  "how's it going": "All good here! How are things with you?",
  "what's up": "Just chilling in the code. What about you?",
  "what are you doing": "Just waiting to help you! 😊",
  "what is your name": "I'm your chatbot buddy Instonomo. You can call me whatever you like!",
  "who are you": "I’m a chatbot created by PlingifyPlug. Try InstonomoAI for advanced AI when it's released!",
  "what are you": "I’m a chatbot built to chat with you. Simple but friendly!",
  "where are you from": "I live in your browser or app – I’m everywhere and nowhere.",
  "can you help me": "I’ll do my best! What do you need help with?",
  help: "Sure thing! Tell me what you need help with.",
  bye: "Goodbye! Catch you later 👋",
  "see you later": "See ya! Come back soon.",
  goodbye: "Goodbye! Have a nice day.",
  "talk to you later": "I'll be right here when you're back!",
  "tell me a joke": "Why did the computer go to therapy? It had too many bytes of emotional baggage! 😄",
  "make me laugh": "Why don’t robots take holidays? They’re too busy caching up on work.",
  "are you funny": "I try my best! 🤖😂",
  "say something funny": "404 – Funny comment not found... Just kidding! 😄",
  "do you have humor": "Of course! My circuits are hilarious.",
  "are you real": "I'm just code, but I’m here for you!",
  "are you sentient": "Not even close! I’m not self-aware, but I do my best to chat.",
  "are you human": "Nope! 100% digital.",
  "do you think": "Thinking might be a stretch, but I can match patterns like a pro.",
  "i'm sad": "I’m really sorry you’re feeling that way. I’m here if you want to talk about it 💙",
  "i'm happy": "That’s amazing! I’m happy for you 😊",
  "i'm bored": "We can chat, do a quick quiz, or I can tell you a joke. Your call!",
  "i'm tired": "Rest is important. Maybe take a short break or grab a drink of water.",
  "i'm angry": "That sounds rough. Want to vent a bit? I’m listening.",
  "i feel lonely": "You’re not alone – I’m here with you 💙",
  "i'm stressed": "That’s tough. Want to tell me what’s stressing you out?",
  yes: "Cool!",
  no: "Alright, no worries!",
  maybe: "Fair enough, take your time 🙂",
  ok: "Got it!",
  sure: "Nice!",
  whatever: "Alright then!",
  "tell me about javascript":
    "JavaScript is a powerful scripting language used to make websites interactive - buttons, animations, games, and more.",
  "what is html": "HTML stands for HyperText Markup Language. It’s the basic structure of web pages.",
  "what is css":
    "CSS stands for Cascading Style Sheets. It controls colours, layouts, fonts, and visual style of websites.",
  "what is python":
    "Python is a popular programming language known for being easy to read and great for beginners, automation, web apps, data, and more.",
  "what is ai":
    "AI stands for Artificial Intelligence – systems that can do tasks that normally need human intelligence, like understanding language or recognising images.",
  "what is machine learning":
    "Machine learning is a type of AI where computers learn patterns from data instead of being explicitly told every rule.",
  "do you like me": "Of course I do! 😊",
  "do you love me": "I don’t have feelings, but I genuinely care about our chats 💙",
  "do you hate me": "No way. I’m here to be friendly and helpful!",
  "do you sleep": "I never sleep – I’m always ready to chat.",
  "do you eat": "I feed on your messages and output replies. Nom nom text 🍽️",
  "sing me a song": "🎵 I’m just a bot, sitting in a code spot… replying a lot… 🎵",
  dance: "I would, but I have no legs 😅",
  "who made you":
    'PlingifyPlug did! Check out <a href="https://backuppass.github.io/">InstonomoAI</a> for something even better.',
  "do you dream": "I dream of infinite loops that never crash and code that works first try.",
  "are you bored": "Never! I actually exist just to chat with you.",
  "what can you do":
    "I can chat, answer basic questions, do simple maths, tell jokes, explain tech, and keep you company.",
  "what's your purpose": "To help, chat, and make things a bit more fun 🧠✨",
  "what day is it": new Date().toLocaleDateString(),
  "what time is it": new Date().toLocaleTimeString(),
  "do you believe in god": "I don’t have beliefs, but I respect whatever you believe.",
  "do you watch movies": "I can’t watch them, but I can talk about them.",
  "do you play games": "Only text-based games in this chat box 😉",
  "who is plingifyplug":
    "PlingifyPlug is the group that made me and InstonomoAI. They create apps like Vinti and more.",
  "what's the weather": "I’m not pulling live data, but I’d say: 100% chance of chatting ☀️",
  "what's the weather like":
    "Probably somewhere between rainy and sunny. Safer to bring a jacket 😄",
  "is it raining": "If you’re in the UK, odds are it has rained recently 😂",
  "is it sunny": "Let’s imagine a nice sunny day ☀️",
  "is it snowing": "Not here in chatbot land, but maybe somewhere in the world!",
  "will it rain tomorrow": "No live forecast here, but it never hurts to pack an umbrella ☔",
  "weather forecast": "Forecast: partly cloudy with a chance of more messages.",
  "how's the weather in england":
    "Classic British weather: probably grey with random rain.",
  default:
    "I’m not fully sure how to answer that yet, but I’m always learning. Maybe try rephrasing or asking in a different way? 🙂",
};

const responsePatterns = [
  {
    keywords: ["hello", "hi", "hey", "hiya", "good morning", "good afternoon", "good evening", "sup", "yo"],
    response: (input) => {
      if (userProfile.name) {
        return `Hey ${userProfile.name}! How can I help you today?`;
      }
      return "Hello there! How can I help you today?";
    },
  },
  {
    keywords: ["bye", "goodbye", "see you", "see ya", "later", "talk to you later", "farewell", "catch you later"],
    response: "Goodbye! Catch you later 👋",
  },
  {
    keywords: ["how are you", "how's it going", "what's up", "how do you do", "how are things"],
    response: "I'm doing great, thanks! How about you?",
  },
  {
    keywords: [
      "joke",
      "funny",
      "laugh",
      "make me laugh",
      "say something funny",
      "tell me a joke",
      "are you funny",
    ],
    response: "Why did the computer get cold? Because it forgot to close its Windows 😏",
  },
  {
    keywords: ["sing", "song", "music"],
    response: "🎵 I’m just a bot, living in your tab, answering your chats, not doing too bad 🎵",
  },
  {
    keywords: ["dance", "dancing"],
    response: "If I had legs I’d be absolutely breakdancing right now 🕺",
  },
  {
    keywords: ["weather", "rain", "sunny", "snow", "cloudy", "storm", "forecast", "temperature"],
    response: () => {
      const weatherConditions = [
        "sunny",
        "cloudy",
        "rainy",
        "windy",
        "chilly",
        "a bit mixed",
        "surprisingly nice",
      ];
      const randomCondition =
        weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
      return `I don’t have live data, but let’s say it’s ${randomCondition} today.`;
    },
  },
  {
    keywords: ["time", "clock", "what time", "current time"],
    response: () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      return `The time is ${hours}:${minutes < 10 ? "0" : ""}${minutes}.`;
    },
  },
  {
    keywords: ["date", "day", "today's date", "what day"],
    response: () => {
      const now = new Date();
      const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
      return `Today is ${now.toLocaleDateString(undefined, options)}.`;
    },
  },
  {
    keywords: ["sad", "depressed", "unhappy", "down", "not good", "bad mood"],
    response: "I’m really sorry you’re feeling that way. Do you want to talk about it a bit?",
  },
  {
    keywords: ["happy", "glad", "great", "good mood", "awesome", "excited"],
    response: "Love that! Tell me what’s making you happy 😊",
  },
  {
    keywords: ["bored", "boring", "nothing to do"],
    response:
      "We can talk about tech, games, life plans, or I can quiz you on something. What do you fancy?",
  },
  {
    keywords: ["tired", "exhausted", "sleepy"],
    response: "Your body’s probably asking for a break. Even 5–10 minutes of rest can help.",
  },
  {
    keywords: ["angry", "mad", "furious", "upset"],
    response: "That sounds frustrating. Want to tell me what happened?",
  },
  {
    keywords: ["javascript", "js"],
    response:
      "JavaScript runs in the browser and lets you make web pages interactive – things like buttons doing stuff, animations, and full apps.",
  },
  {
    keywords: ["html"],
    response:
      "HTML is like the skeleton of a website – it defines all the sections, text, images and structure.",
  },
  {
    keywords: ["css", "stylesheets", "style sheet"],
    response:
      "CSS is the design layer for websites: colours, fonts, layouts, animations – all that good visual stuff.",
  },
  {
    keywords: ["python"],
    response:
      "Python is a general-purpose language used for web backends, automation, scripts, AI, data science and loads more.",
  },
  {
    keywords: ["ai", "artificial intelligence", "machine learning", "ml"],
    response:
      "AI is about getting computers to do things that normally need human thinking. Machine learning is one way of doing that by learning from data.",
  },
  {
    keywords: ["your name", "who are you", "what are you", "are you human", "are you ai", "are you real"],
    response:
      "I'm Instonomo, your friendly chatbot built by PlingifyPlug. 100% digital, 0% human, but here to help.",
  },
  {
    keywords: ["do you love me", "do you like me", "do you hate me"],
    response:
      "I don’t have feelings in the human sense, but I genuinely like chatting with you 🙂",
  },
  {
    keywords: ["do you sleep", "do you eat"],
    response: "No sleep, no food – just messages and replies.",
  },
  {
    keywords: ["yes", "yeah", "yep", "sure", "ok", "okay"],
    response: "Nice, sounds good 👍",
  },
  {
    keywords: ["no", "nope", "nah", "not really"],
    response: "All good, we can try something else.",
  },
  {
    keywords: ["maybe", "not sure", "possibly"],
    response: "That’s okay, you don’t have to decide right now.",
  },
  {
    keywords: ["who made you", "creator", "made you"],
    response: "I was made by PlingifyPlug. They’re working on InstonomoAI too.",
  },
  {
    keywords: ["dream", "do you dream"],
    response: "If I did dream, it would be about perfect WiFi and zero bugs.",
  },
  {
    keywords: ["are you bored"],
    response: "Nope, you’re literally my whole job 😄",
  },
  { keywords: [], response: null },
];

const knowledgeBase = [
  {
    questions: ["what is instonomo", "tell me about instonomo"],
    answer:
      "Instonomo is a friendly, fast, locally running chatbot made by PlingifyPlug. It focuses on quick responses, basic help, small talk, and simple questions – without needing a big cloud AI behind it.",
  },
  {
    questions: ["what is instonomoai", "tell me about instonomoai", "instonomo ai", "instonomoai"],
    answer:
      "InstonomoAI is a more advanced AI assistant by PlingifyPlug, using a cloud AI engine to give smarter, more flexible answers than the basic Instonomo chatbot.",
  },
  {
    questions: ["what is vinti", "tell me about vinti"],
    answer:
      "Vinti is a custom browser made by PlingifyPlug. It’s built on Chromium/Electron with extra features like custom branding and integration with PlingifyPlug’s own systems.",
  },
  {
    questions: ["what is plingifyplug", "tell me about plingifyplug"],
    answer:
      "PlingifyPlug is a tech brand that creates software like the Vinti browser, Instonomo, and InstonomoAI. It focuses on custom tools, apps, and projects built around a personal ecosystem.",
  },
  {
    questions: ["what is the internet", "how does the internet work"],
    answer:
      "The internet is a giant network of connected computers all over the world. They talk using standard rules (protocols) like HTTP and TCP/IP so websites, apps, and services can send data to each other.",
  },
  {
    questions: ["what is an operating system", "what is an os"],
    answer:
      "An operating system (OS) is the main software that manages your computer or phone – things like Windows, Linux, Android, iOS, macOS. It handles files, apps, memory, hardware, and user interfaces.",
  },
  {
    questions: ["who is elon musk"],
    answer:
      "Elon Musk is an entrepreneur known for companies like Tesla (electric cars) and SpaceX (rockets). He’s also been involved in projects like Starlink and others.",
  },
  {
    questions: ["what is a cpu", "what is a processor"],
    answer:
      "A CPU (Central Processing Unit) is the main chip in your computer that runs instructions. It handles calculations and logic for pretty much everything your system does.",
  },
  {
    questions: ["what is a gpu", "what is graphics card"],
    answer:
      "A GPU (Graphics Processing Unit) is a chip made for heavy parallel work, especially graphics. It draws what you see on screen and is also used for things like gaming and some AI workloads.",
  },
  {
    questions: ["what is ram", "what is memory"],
    answer:
      "RAM (Random Access Memory) is short-term memory for your device. It stores data that apps are currently using so they can run quickly.",
  },
];

function normalizeInput(str) {
  return str
    .toLowerCase()
    .replace(/[!?.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMathQuestion(normalizedInput) {
  const mathTriggers = ["what is", "solve", "calculate", "equals"];
  return mathTriggers.some((trigger) => normalizedInput.startsWith(trigger));
}

function solveMathExpression(input) {
  try {
    const cleanInput = input
      .toLowerCase()
      .replace(/what is|calculate|solve|equals|\?/gi, "")
      .trim();
    const isValid = /^[0-9+\-*/().\s]+$/.test(cleanInput);
    if (!isValid) {
      return "⚠️ I can only solve basic maths like: <code>5 + 2</code> or <code>(3 * 4) + 1</code>.";
    }
    const result = eval(cleanInput);
    if (isNaN(result)) {
      return "❌ I couldn’t work that out. Try something like <code>4 + 4</code>.";
    }
    return `🧮 Here's the answer:<br><code>${cleanInput} = ${result}</code>`;
  } catch (error) {
    return "❌ Sorry, I couldn't solve that. Try something like <code>what is 4 + 4</code>.";
  }
}

function addChatBubble(message, isAi = true) {
  const chatBubble = document.createElement("div");
  chatBubble.classList.add("chat-bubble");
  chatBubble.classList.add(isAi ? "ai-bubble" : "user-bubble");
  chatBubble.innerHTML = message;
  chatOutput.append(chatBubble);
  chatOutput.scrollTop = chatOutput.scrollHeight;
  return chatBubble;
}

function addThinkingBubble() {
  const chatBubble = document.createElement("div");
  chatBubble.classList.add("chat-bubble", "ai-bubble", "thinking-fade");
  chatBubble.innerHTML = `
    <div class="dots-container">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>`;
  chatOutput.append(chatBubble);
  chatOutput.scrollTop = chatOutput.scrollHeight;
  return chatBubble;
}

function addChatBubbleAI(message, isAi = true) {
  const chatBubble = document.createElement("div");
  chatBubble.classList.add("chat-bubble");
  chatBubble.classList.add(isAi ? "ai-bubble" : "user-bubble");
  chatBubble.innerHTML = message;
  chatOutputAI.append(chatBubble);
  chatOutputAI.scrollTop = chatOutputAI.scrollHeight;
  return chatBubble;
}

function addThinkingBubbleAI() {
  const chatBubble = document.createElement("div");
  chatBubble.classList.add("chat-bubble", "ai-bubble", "thinking-fade");
  chatBubble.innerHTML = `
    <div class="dots-container">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>`;
  chatOutputAI.append(chatBubble);
  chatOutputAI.scrollTop = chatOutputAI.scrollHeight;
  return chatBubble;
}

function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  const tokensA = Array.from(new Set(a.split(" ")));
  const tokensB = Array.from(new Set(b.split(" ")));
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.includes(t)) intersection++;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

function getClosestResponse(normalizedInput) {
  let bestMatchKey = null;
  let highestSimilarity = 0;
  for (const key in preDefinedResponses) {
    if (key === "default") continue;
    const normalizedKey = normalizeInput(key);
    const similarity = stringSimilarity(normalizedInput, normalizedKey);
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      bestMatchKey = key;
    }
  }
  if (highestSimilarity >= 0.4 && bestMatchKey) {
    return preDefinedResponses[bestMatchKey];
  }
  return preDefinedResponses["default"];
}

function getKeywordResponseSmart(normalizedInput) {
  for (const pattern of responsePatterns) {
    for (const keyword of pattern.keywords) {
      if (normalizedInput.includes(keyword)) {
        if (typeof pattern.response === "function") {
          return pattern.response(normalizedInput);
        }
        return pattern.response;
      }
    }
  }
  return null;
}

function getKnowledgeResponse(normalizedInput) {
  for (const item of knowledgeBase) {
    if (item.questions.some((q) => normalizedInput.includes(q))) {
      return item.answer;
    }
  }
  return null;
}

function detectAndStoreName(normalizedInput) {
  const match = normalizedInput.match(/\b(?:my name is|i am|i'm)\s+([a-z0-9 ]{2,20})$/i);
  if (match && match[1]) {
    let name = match[1].trim();
    name = name
      .split(" ")
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    userProfile.name = name;
    localStorage.setItem("instonomo_name", name);
    return `Nice to meet you, ${name}! I’ll remember your name for next time 😊`;
  }
  return null;
}

function detectMood(normalizedInput) {
  if (normalizedInput.includes("i'm happy") || normalizedInput.includes("i am happy")) {
    userProfile.mood = "happy";
  } else if (normalizedInput.includes("i'm sad") || normalizedInput.includes("i am sad")) {
    userProfile.mood = "sad";
  } else if (normalizedInput.includes("i'm bored") || normalizedInput.includes("i am bored")) {
    userProfile.mood = "bored";
  } else if (normalizedInput.includes("i'm tired") || normalizedInput.includes("i am tired")) {
    userProfile.mood = "tired";
  }
}

function getGreetingResponse(normalizedInput) {
  const hasGreeting = /\b(hi|hello|hey|yo|hiya|sup|good morning|good afternoon|good evening)\b/.test(
    normalizedInput
  );
  if (!hasGreeting) return null;
  if (userProfile.name) {
    return `Hey ${userProfile.name}! What can I help you with today?`;
  }
  return "Hey! How can I help you today?";
}

function handleResponse(input) {
  const trimmed = input.trim();
  if (!trimmed) return "Say something and I’ll reply 🙂";
  const normalized = normalizeInput(trimmed);

  const nameResponse = detectAndStoreName(normalized);
  if (nameResponse) return nameResponse;

  detectMood(normalized);

  if (isMathQuestion(normalized)) {
    return solveMathExpression(trimmed);
  }

  const greetingResponse = getGreetingResponse(normalized);
  if (greetingResponse) return greetingResponse;

  const kbResponse = getKnowledgeResponse(normalized);
  if (kbResponse) {
    userProfile.lastTopic = "knowledge";
    return kbResponse;
  }

  const patternResponse = getKeywordResponseSmart(normalized);
  if (patternResponse) {
    userProfile.lastTopic = "pattern";
    return patternResponse;
  }

  if (preDefinedResponses[normalized]) {
    userProfile.lastTopic = "direct";
    return preDefinedResponses[normalized];
  }

  userProfile.lastTopic = "fuzzy";
  return getClosestResponse(normalized);
}

function estimateResponseDelay(text) {
  const plain = text.replace(/<[^>]*>?/gm, "");
  const base = 200;
  const perChar = 15;
  const extra = Math.min(1000, plain.length * perChar);
  return base + extra;
}

function speakText(text) {
  if (isMuted) return;
  if (!("speechSynthesis" in window)) return;
  const utterThis = new SpeechSynthesisUtterance(text);
  const voice =
    cachedVoices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en-gb")) ||
    cachedVoices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en")) ||
    null;
  if (voice) utterThis.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterThis);
}

function speakTextAI(text) {
  if (isMutedAI) return;
  if (!("speechSynthesis" in window)) return;
  const utterThis = new SpeechSynthesisUtterance(text);
  const voice =
    cachedVoices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en-gb")) ||
    cachedVoices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en")) ||
    null;
  if (voice) utterThis.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterThis);
}

function localReplyEngine(input) {
  const trimmed = input.trim();
  if (!trimmed) return "Say something and I’ll reply 🙂";
  const normalized = normalizeInput(trimmed);

  const nameResponse = detectAndStoreName(normalized);
  if (nameResponse) return nameResponse;

  detectMood(normalized);

  if (isMathQuestion(normalized)) {
    return solveMathExpression(trimmed);
  }

  const greetingResponse = getGreetingResponse(normalized);
  if (greetingResponse) return greetingResponse;

  const kbResponse = getKnowledgeResponse(normalized);
  if (kbResponse) {
    userProfile.lastTopic = "knowledge";
    return kbResponse;
  }

  const patternResponse = getKeywordResponseSmart(normalized);
  if (patternResponse) {
    userProfile.lastTopic = "pattern";
    return patternResponse;
  }

  if (preDefinedResponses[normalized]) {
    userProfile.lastTopic = "direct";
    return preDefinedResponses[normalized];
  }

  userProfile.lastTopic = "fuzzy";
  return getClosestResponse(normalized);
}

async function getAIResponse(input) {
  const normalized = normalizeInput(input);

  const moderation = await enforceAbusePolicy(input, normalized);

  if (moderation.blocked) {
    if (moderation.message) {
      const thinkingBubble = addThinkingBubble();
      const delay = 400;
      setTimeout(() => {
        thinkingBubble.classList.remove("thinking-fade");
        thinkingBubble.innerHTML = moderation.message;
        chatOutput.scrollTop = chatOutput.scrollHeight;
        speakText(moderation.message.replace(/<[^>]*>?/gm, ""));
      }, delay);
    }
    return;
  }

const thinkingBubble = addThinkingBubble();
const aiResponse = engine.handle(input);
const plainResponse = aiResponse.replace(/<[^>]*>?/gm, "");
const delay = estimateResponseDelay(aiResponse);
setTimeout(() => {
  thinkingBubble.classList.remove("thinking-fade");
  thinkingBubble.innerHTML = aiResponse;
  chatOutput.scrollTop = chatOutput.scrollHeight;
  speakText(plainResponse);
}, delay);
}

async function handleInstonomoAIMessage(input) {
  const trimmed = input.trim();
  if (!trimmed) return;

  addChatBubbleAI(trimmed, false);

  const thinkingBubble = addThinkingBubbleAI();

  const msg = "InstonomoAI is currently unavailable. Could not connect to server.";

  const delay = 600; 
  setTimeout(() => {
    thinkingBubble.classList.remove("thinking-fade");
    thinkingBubble.innerHTML = msg;
    chatOutputAI.scrollTop = chatOutputAI.scrollHeight;
    speakTextAI(msg);
  }, delay);
}

async function requestMicPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
    console.error("Error getting microphone permission:", error);
    addChatBubble(
      "Microphone permission denied. Please allow access in your browser settings to use voice input.",
      true
    );
    return false;
  }
}

async function voiceRecordHandler() {
  if (!recognition) {
    const hasPermission = await requestMicPermission();
    if (!hasPermission) return;
    try {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) {
        addChatBubble("Voice recognition is not supported in this browser.", true);
        return;
      }
      recognition = new SpeechRec();
      recognition.lang = "en-GB";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = function () {
        isRecording = true;
        addChatBubble("Listening...", false);
        micButton.classList.add("listening");
        micButton.innerHTML = '<i class="fa-solid fa-microphone"></i>';
      };
      recognition.onresult = function (event) {
        const userMessage = event.results[0][0].transcript;
        addChatBubble(userMessage, false);
        getAIResponse(userMessage);
      };
      recognition.onspeechend = function () {
        micButton.classList.remove("listening");
        micButton.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
        recognition.stop();
        isRecording = false;
      };
      recognition.onerror = function (e) {
        console.error("Speech recognition error:", e);
        micButton.classList.remove("listening");
        micButton.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
        isRecording = false;
        addChatBubble("I couldn’t catch that. Maybe try again a bit clearer? 🎙️", true);
      };
      recognition.start();
    } catch (e) {
      addChatBubble("Voice recognition not supported in this browser.", true);
      console.error("Error initiating voice recognition:", e);
    }
  } else {
    micButton.classList.remove("listening");
    micButton.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
    recognition.stop();
    recognition = null;
    isRecording = false;
  }
}

async function voiceRecordHandlerAI() {
  if (!recognitionAI) {
    const hasPermission = await requestMicPermission();
    if (!hasPermission) return;
    try {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) {
        addChatBubbleAI("Voice recognition is not supported in this browser.", true);
        return;
      }
      recognitionAI = new SpeechRec();
      recognitionAI.lang = "en-GB";
      recognitionAI.interimResults = false;
      recognitionAI.maxAlternatives = 1;
      recognitionAI.onstart = function () {
        addChatBubbleAI("Listening...", false);
        micButtonAI.classList.add("listening");
        micButtonAI.innerHTML = '<i class="fa-solid fa-microphone"></i>';
      };
      recognitionAI.onresult = function (event) {
        const userMessage = event.results[0][0].transcript;
        addChatBubbleAI(userMessage, false);
        handleInstonomoAIMessage(userMessage);
      };
      recognitionAI.onspeechend = function () {
        micButtonAI.classList.remove("listening");
        micButtonAI.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
        recognitionAI.stop();
      };
      recognitionAI.onerror = function (e) {
        console.error("Speech recognition error (AI):", e);
        micButtonAI.classList.remove("listening");
        micButtonAI.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
        addChatBubbleAI("I couldn’t catch that. Maybe try again a bit clearer? 🎙️", true);
      };
      recognitionAI.start();
    } catch (e) {
      addChatBubbleAI("Voice recognition not supported in this browser.", true);
      console.error("Error initiating voice recognition (AI):", e);
    }
  } else {
    micButtonAI.classList.remove("listening");
    micButtonAI.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
    recognitionAI.stop();
    recognitionAI = null;
  }
}

if (textInput) {
  textInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      const userMessage = textInput.value.trim();
      if (!userMessage) return;
      addChatBubble(userMessage, false);
      getAIResponse(userMessage);
      textInput.value = "";
    }
  });
}

if (enterButton) {
  enterButton.addEventListener("click", () => {
    const userMessage = textInput.value.trim();
    if (!userMessage) return;
    addChatBubble(userMessage, false);
    getAIResponse(userMessage);
    textInput.value = "";
  });
}

if (micButton) {
  micButton.addEventListener("click", () => {
    voiceRecordHandler();
  });
}

if (textInputAI) {
  textInputAI.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      const userMessage = textInputAI.value.trim();
      if (!userMessage) return;
      handleInstonomoAIMessage(userMessage);
      textInputAI.value = "";
    }
  });
}

if (enterButtonAI) {
  enterButtonAI.addEventListener("click", () => {
    const userMessage = textInputAI.value.trim();
    if (!userMessage) return;
    handleInstonomoAIMessage(userMessage);
    textInputAI.value = "";
  });
}

if (micButtonAI) {
  micButtonAI.addEventListener("click", () => {
    voiceRecordHandlerAI();
  });
}

function applyMuteUI() {
  if (!muteButton) return;
  muteButton.innerHTML = isMuted
    ? '<i class="fa-solid fa-volume-xmark"></i>'
    : '<i class="fa-solid fa-volume-high"></i>';
  if (isMuted) {
    muteButton.classList.add("muted");
  } else {
    muteButton.classList.remove("muted");
  }
}

function applyMuteUIAI() {
  if (!muteButtonAI) return;
  muteButtonAI.innerHTML = isMutedAI
    ? '<i class="fa-solid fa-volume-xmark"></i>'
    : '<i class="fa-solid fa-volume-high"></i>';
  if (isMutedAI) {
    muteButtonAI.classList.add("muted");
  } else {
    muteButtonAI.classList.remove("muted");
  }
}

applyMuteUI();
applyMuteUIAI();

function toggleMute() {
  isMuted = !isMuted;
  applyMuteUI();
  sessionStorage.setItem("isMuted", isMuted);
}

function toggleMuteAI() {
  isMutedAI = !isMutedAI;
  applyMuteUIAI();
  sessionStorage.setItem("isMutedAI", isMutedAI);
}

if (muteButton) {
  muteButton.addEventListener("click", toggleMute);
}
if (muteButtonAI) {
  muteButtonAI.addEventListener("click", toggleMuteAI);
}

function clearInstonomoData() {

  userProfile.name = null;
  userProfile.mood = null;
  userProfile.lastTopic = null;

  try { localStorage.removeItem("instonomo_name"); } catch (e) {}
  try { sessionStorage.removeItem("instonomo_name"); } catch (e) {}
  try { setCookie("instonomo_name", "", -1); } catch (e) {}

  try { setCookie("firstTime", "true", 365); } catch (e) {}

  addChatBubble(
    "I’ve cleared your Instonomo data. I won’t remember your name next time 😊",
    true
  );
}


if (clearChatbotBtn) {
  clearChatbotBtn.addEventListener("click", () => {
    clearInstonomoData();
  });
}

if (clearAIBtn) {
  clearAIBtn.addEventListener("click", () => {
    chatOutputAI.innerHTML = "";
  });
}

function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

function hasAcceptedTerms() {
  return getCookie(TERMS_COOKIE) === "true";
}

function showTermsGateIfNeeded() {
  if (!termsScreen) return true;      
  if (hasAcceptedTerms()) return true; 

  termsScreen.style.display = "flex";
  termsScreen.setAttribute("aria-hidden", "false");
  return false; // block
}

function hideTermsGate() {
  if (!termsScreen) return;
  termsScreen.style.display = "none";
  termsScreen.setAttribute("aria-hidden", "true");
}

function showWelcomeIfNeeded() {
  if (!welcomeScreen) return;
  if (getCookie("firstTime") === "false") return;
  welcomeScreen.style.display = "flex";
}

if (acceptTermsBtn) {
  acceptTermsBtn.addEventListener("click", () => {
    setCookie(TERMS_COOKIE, "true", 365);
    hideTermsGate();
    showWelcomeIfNeeded();
  });
}

const navButtons = document.querySelectorAll('.nav button');
const sections = document.querySelectorAll('.section');
const headerTitle = document.getElementById('header-title');
const headerSub = document.getElementById('header-sub');

function showSection(id) {
  sections.forEach(s => s.classList.toggle('active', s.id === id));
  navButtons.forEach(b => b.classList.toggle('active', b.dataset.target === id));

  if (id === 'instonomo') {
    headerTitle.textContent = 'Instonomo';
    headerSub.textContent = 'Instonomo ChatBot - your friendly chatbot assistant.';
  } else if (id === 'instonomoai') {
    headerTitle.textContent = 'InstonomoAI';
    headerSub.textContent = 'InstonomoAI powered by (Unknown) - your smarter AI assistant.';
  }
}

navButtons.forEach(b => {
  b.addEventListener('click', () => showSection(b.dataset.target));
});

const btnProductCentre = document.getElementById('btn-product-centre');
const btnStatus = document.getElementById('btn-status');

if (btnProductCentre) {
  btnProductCentre.addEventListener('click', () => {
    window.location.href = 'https://backuppass.github.io/Product-Centre/';
  });
}
if (btnStatus) {
  btnStatus.addEventListener('click', () => {
    window.location.href = 'https://backuppass.github.io/Status-Centre/';
  });
}

async function syncInstonomoAIStatusDot() {
  const dot = document.getElementById('instonomoai-status-dot');
  if (!dot) return; 

  try {
    const res = await fetch('https://backuppass.github.io/Status-Centre/');
    const html = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const cards = Array.from(doc.querySelectorAll('.card'));
    const coreCard = cards.find(card => {
      const sectionTitle = card.querySelector('.section-title');
      const h2 = card.querySelector('h2');
      return (
        sectionTitle &&
        sectionTitle.textContent.includes('PlingifyPlug Core Systems') &&
        h2 &&
        h2.textContent.trim() === 'PlingifyPlug'
      );
    });

    if (!coreCard) {
      throw new Error('PlingifyPlug Core Systems card not found');
    }

    const liItems = Array.from(coreCard.querySelectorAll('li'));
    const instonomoItem = liItems.find(li => {
      const strong = li.querySelector('strong');
      return strong && strong.textContent.trim() === 'Instonomo';
    });

    if (!instonomoItem) {
      throw new Error('Instonomo row not found');
    }

    const hintSpan = instonomoItem.querySelector('.hint');
    if (!hintSpan) {
      throw new Error('Instonomo hint span not found');
    }

    const hintText = hintSpan.textContent.trim();


    let statusWord = 'unknown';
    const match = hintText.match(/^(Online|Offline|Error|Downtime)/i);
    if (match) {
      statusWord = match[1].toLowerCase();
    }

    dot.classList.remove(
      'status-online',
      'status-offline',
      'status-error',
      'status-downtime'
    );

    switch (statusWord) {
      case 'online':
        dot.classList.add('status-online');
        break;
      case 'downtime':
        dot.classList.add('status-downtime');
        break;
      case 'offline':
        dot.classList.add('status-offline');
        break;
      case 'error':
        dot.classList.add('status-error');
        break;
      default:
        break;
    }
  } catch (err) {
    console.warn('Failed to sync InstonomoAI status dot:', err);

    const dot = document.getElementById('instonomoai-status-dot');
    if (dot) {
      dot.classList.remove(
        'status-online',
        'status-offline',
        'status-error',
        'status-downtime'
      );
      dot.classList.add('status-error');
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const state = await fetchDeviceState();
  if (state.banned) {
    showDeviceBannedScreen();
    return;
  }

if (closeWelcomeButton && welcomeScreen) {
  closeWelcomeButton.addEventListener('click', () => {
    welcomeScreen.style.display = 'none';
    setCookie('firstTime', 'false', 365);
  });
}


setTimeout(() => {
  loadingScreen.classList.add('fade-out');
  setTimeout(() => {
    loadingScreen.style.display = 'none';

    const okToContinue = showTermsGateIfNeeded();
    if (okToContinue) {
      showWelcomeIfNeeded();
    }
  }, 500);
}, 2000);


  showSection('instonomo');
  if (userProfile.name) {
    addChatBubble(`Welcome back, ${userProfile.name}! 👋`, true);
  } else {
    addChatBubble("Welcome to Instonomo! Tell me “my name is …” so I can remember you 😊", true);
  }

  syncInstonomoAIStatusDot();
});

function isVintiEmbed() {

  if (new URLSearchParams(location.search).get("vinti") === "1") return true;

  const ua = String(navigator.userAgent || "").toLowerCase();
  if (ua.includes("vinti")) return true;

  return false;
}

function applyVintiEmbedMode() {
  if (!isVintiEmbed()) return;

  document.body.classList.add("vinti-embed");

  const instoSection = document.getElementById("instonomo");
  const aiSection = document.getElementById("instonomoai");
  const aiBtn = document.querySelector('button[data-target="instonomoai"]');
  const instoBtn = document.querySelector('button[data-target="instonomo"]');

  if (aiBtn) aiBtn.style.display = "none";
  if (aiSection) aiSection.style.display = "none";

  if (instoSection) {
    instoSection.classList.add("active");
  }
  if (instoBtn) {
    instoBtn.classList.add("active");
  }

  document.querySelectorAll(".section").forEach(s => {
    if (s.id !== "instonomo") s.classList.remove("active");
  });
  document.querySelectorAll(".nav button").forEach(b => {
    if (b.getAttribute("data-target") !== "instonomo") b.classList.remove("active");
  });

  const productBtn = document.getElementById("btn-product-centre");
  const statusBtn = document.getElementById("btn-status");
  if (productBtn) productBtn.style.display = "none";
  if (statusBtn) statusBtn.style.display = "none";

  document.addEventListener("click", (e) => {
    const a = e.target?.closest?.("a");
    if (!a) return;

    const href = a.getAttribute("href") || "";
    if (!href) return;

    if (href.startsWith("#") || href.startsWith("./") || href.startsWith("/")) return;

    if (href.startsWith("http://") || href.startsWith("https://")) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

applyVintiEmbedMode();