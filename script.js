const chatOutput = document.getElementById('chat-output');
const textInput = document.getElementById("text-input");
const micButton = document.getElementById('mic-button');
const muteButton = document.getElementById('mute-button');
const enterButton = document.getElementById('enter-button');
const welcomeScreen = document.getElementById('welcome-screen');
const closeWelcomeButton = document.getElementById('close-welcome');
const loadingScreen = document.getElementById('loading-screen');

let isRecording = false;
let recognition;
let isMuted = sessionStorage.getItem('isMuted') === 'true' || false;

const userProfile = {
  name: localStorage.getItem('instonomo_name') || null,
  mood: null,
  lastTopic: null
};

let cachedVoices = [];
if ('speechSynthesis' in window) {
  const loadVoices = () => {
    cachedVoices = speechSynthesis.getVoices();
  };
  loadVoices();
  if (typeof speechSynthesis.onvoiceschanged !== 'undefined') {
    speechSynthesis.onvoiceschanged = loadVoices;
  }
}

function generateDeviceId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'dev-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
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
  let id = getFromAnyStorage('instonomo_device_id');
  if (!id) {
    id = generateDeviceId();
  }
  setInAllStorages('instonomo_device_id', id);
  return id;
}

const deviceId = getOrCreateDeviceId();

const ABUSE_WORDS = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "twat",
  "wanker",
  "bastard",
  "dickhead",
  "prick"
];

const MAX_WARNINGS_BEFORE_FINAL = 2;
const BAN_AFTER_STRIKE = 4;

function messageHasAbuse(normalizedInput) {
  if (!normalizedInput) return false;
  return ABUSE_WORDS.some(word => {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    return pattern.test(normalizedInput);
  });
}

function showDeviceBannedScreen() {
  try {
    if (typeof speechSynthesis !== "undefined") {
      speechSynthesis.cancel();
    }
  } catch (e) {
    console.warn("Error cancelling speech:", e);
  }
  document.body.innerHTML = "Device Banned. Please contact support to appeal this decision.";
  document.body.style = "margin:20px;font-family:system-ui, sans-serif;background:#ffffff;color:#000000;";
  document.documentElement.style = "margin:0;padding:0;background:#ffffff;";
}

function enforceAbusePolicy(normalizedInput) {
  const alreadyBanned = getFromAnyStorage("instonomo_device_banned") === "true";
  if (alreadyBanned) {
    showDeviceBannedScreen();
    return { blocked: true, message: null };
  }
  if (!messageHasAbuse(normalizedInput)) {
    return { blocked: false, message: null };
  }
  let strikes = parseInt(getFromAnyStorage("instonomo_strikes") || "0", 10);
  if (isNaN(strikes)) strikes = 0;
  strikes += 1;
  setInAllStorages("instonomo_strikes", String(strikes));
  if (strikes <= MAX_WARNINGS_BEFORE_FINAL) {
    const msg = `Please don’t use rude or offensive language. This is warning ${strikes} of 3.`;
    return { blocked: true, message: msg };
  }
  if (strikes === MAX_WARNINGS_BEFORE_FINAL + 1) {
    const msg = "This is your final warning. One more offensive message and this device will be banned from Instonomo on this site.";
    return { blocked: true, message: msg };
  }
  setInAllStorages("instonomo_device_banned", "true");
  showDeviceBannedScreen();
  return { blocked: true, message: null };
}

const preDefinedResponses = {
  "yo": "Hey! What’s up?",
  "hey": "Hey there! 👋",
  "hi": "Hiya! How can I help?",
  "hello": "Hello there!",
  "good morning": "Good morning! ☀️",
  "good afternoon": "Good afternoon! How’s your day going?",
  "good evening": "Good evening! Need anything?",
  "good night": "Good night! Sleep well 🌙",
  "hiya": "Hey hey!",
  "sup": "Not much, you?",
  "how are you": "I'm doing great, thanks! How about you?",
  "how's it going": "All good here! How are things with you?",
  "what's up": "Just chilling in the code. What about you?",
  "what are you doing": "Just waiting to help you! 😊",
  "what is your name": "I'm your chatbot buddy Instonomo. You can call me whatever you like!",
  "who are you": "I’m a chatbot created by PlingifyPlug. Try InstonomoAI for advanced AI when it's released!",
  "what are you": "I’m a chatbot built to chat with you. Simple but friendly!",
  "where are you from": "I live in your browser or app – I’m everywhere and nowhere.",
  "can you help me": "I’ll do my best! What do you need help with?",
  "help": "Sure thing! Tell me what you need help with.",
  "bye": "Goodbye! Catch you later 👋",
  "see you later": "See ya! Come back soon.",
  "goodbye": "Goodbye! Have a nice day.",
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
  "i'm sad": "I’m really sorry to hear that. I’m here if you want to talk about it 💙",
  "i'm happy": "That’s amazing! I’m happy for you 😊",
  "i'm bored": "We can chat, do a quick quiz, or I can tell you a joke. Your call!",
  "i'm tired": "Rest is important. Maybe take a short break or grab a drink of water.",
  "i'm angry": "That sounds rough. Want to vent a bit? I’m listening.",
  "i feel lonely": "You’re not alone – I’m here with you 💙",
  "i'm stressed": "That’s tough. Want to tell me what’s stressing you out?",
  "yes": "Cool!",
  "no": "Alright, no worries!",
  "maybe": "Fair enough, take your time 🙂",
  "ok": "Got it!",
  "sure": "Nice!",
  "whatever": "Alright then!",
  "tell me about javascript": "JavaScript is a powerful scripting language used to make websites interactive — buttons, animations, games, and more.",
  "what is html": "HTML stands for HyperText Markup Language. It’s the basic structure of web pages.",
  "what is css": "CSS stands for Cascading Style Sheets. It controls colours, layouts, fonts, and visual style of websites.",
  "what is python": "Python is a popular programming language known for being easy to read and great for beginners, automation, web apps, data, and more.",
  "what is ai": "AI stands for Artificial Intelligence – systems that can do tasks that normally need human intelligence, like understanding language or recognising images.",
  "what is machine learning": "Machine learning is a type of AI where computers learn patterns from data instead of being explicitly told every rule.",
  "do you like me": "Of course I do! 😊",
  "do you love me": "I don’t have feelings, but I genuinely care about our chats 💙",
  "do you hate me": "No way. I’m here to be friendly and helpful!",
  "do you sleep": "I never sleep – I’m always ready to chat.",
  "do you eat": "I feed on your messages and output replies. Nom nom text 🍽️",
  "sing me a song": "🎵 I’m just a bot, sitting in a code spot… replying a lot… 🎵",
  "dance": "I would, but I have no legs 😅",
  "who made you": "PlingifyPlug did! Check out <a href=\"https://backuppass.github.io/\">InstonomoAI</a> for something even better.",
  "do you dream": "I dream of infinite loops that never crash and code that works first try.",
  "are you bored": "Never! I actually exist just to chat with you.",
  "what can you do": "I can chat, answer basic questions, do simple maths, tell jokes, explain tech, and keep you company.",
  "what's your purpose": "To help, chat, and make things a bit more fun 🧠✨",
  "what day is it": new Date().toLocaleDateString(),
  "what time is it": new Date().toLocaleTimeString(),
  "do you believe in god": "I don’t have beliefs, but I respect whatever you believe.",
  "do you watch movies": "I can’t watch them, but I can talk about them.",
  "do you play games": "Only text-based games in this chat box 😉",
  "who is plingifyplug": "PlingifyPlug is the group that made me and InstonomoAI. They create apps like Vinti and more.",
  "what's the weather": "I’m not pulling live data, but I’d say: 100% chance of chatting ☀️",
  "what's the weather like": "Probably somewhere between rainy and sunny. Safer to bring a jacket 😄",
  "is it raining": "If you’re in the UK, odds are it has rained recently 😂",
  "is it sunny": "Let’s imagine a nice sunny day ☀️",
  "is it snowing": "Not here in chatbot land, but maybe somewhere in the world!",
  "will it rain tomorrow": "No live forecast here, but it never hurts to pack an umbrella ☔",
  "weather forecast": "Forecast: partly cloudy with a chance of more messages.",
  "how's the weather in england": "Classic British weather: probably grey with random rain.",
  "default": "I’m not fully sure how to answer that yet, but I’m always learning. Maybe try rephrasing or asking in a different way? 🙂"
};

const responsePatterns = [
  {
    keywords: ["hello","hi","hey","hiya","good morning","good afternoon","good evening","sup","yo"],
    response: input => {
      if (userProfile.name) {
        return `Hey ${userProfile.name}! How can I help you today?`;
      }
      return "Hello there! How can I help you today?";
    }
  },
  {
    keywords: ["bye","goodbye","see you","see ya","later","talk to you later","farewell","catch you later"],
    response: "Goodbye! Catch you later 👋"
  },
  {
    keywords: ["how are you","how's it going","what's up","how do you do","how are things"],
    response: "I'm doing great, thanks! How about you?"
  },
  {
    keywords: ["joke","funny","laugh","make me laugh","say something funny","tell me a joke","are you funny"],
    response: "Why did the computer get cold? Because it forgot to close its Windows 😏"
  },
  {
    keywords: ["sing","song","music"],
    response: "🎵 I’m just a bot, living in your tab, answering your chats, not doing too bad 🎵"
  },
  {
    keywords: ["dance","dancing"],
    response: "If I had legs I’d be absolutely breakdancing right now 🕺"
  },
  {
    keywords: ["weather","rain","sunny","snow","cloudy","storm","forecast","temperature"],
    response: () => {
      const weatherConditions = ["sunny", "cloudy", "rainy", "windy", "chilly", "a bit mixed", "surprisingly nice"];
      const randomCondition = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
      return `I don’t have live data, but let’s say it’s ${randomCondition} today.`;
    }
  },
  {
    keywords: ["time","clock","what time","current time"],
    response: () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      return `The time is ${hours}:${minutes < 10 ? '0' : ''}${minutes}.`;
    }
  },
  {
    keywords: ["date","day","today's date","what day"],
    response: () => {
      const now = new Date();
      const options = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
      return `Today is ${now.toLocaleDateString(undefined, options)}.`;
    }
  },
  {
    keywords: ["sad","depressed","unhappy","down","not good","bad mood"],
    response: "I’m really sorry you’re feeling that way. Do you want to talk about it a bit?"
  },
  {
    keywords: ["happy","glad","great","good mood","awesome","excited"],
    response: "Love that! Tell me what’s making you happy 😊"
  },
  {
    keywords: ["bored","boring","nothing to do"],
    response: "We can talk about tech, games, life plans, or I can quiz you on something. What do you fancy?"
  },
  {
    keywords: ["tired","exhausted","sleepy"],
    response: "Your body’s probably asking for a break. Even 5–10 minutes of rest can help."
  },
  {
    keywords: ["angry","mad","furious","upset"],
    response: "That sounds frustrating. Want to tell me what happened?"
  },
  {
    keywords: ["javascript","js"],
    response: "JavaScript runs in the browser and lets you make web pages interactive – things like buttons doing stuff, animations, and full apps."
  },
  {
    keywords: ["html"],
    response: "HTML is like the skeleton of a website – it defines all the sections, text, images and structure."
  },
  {
    keywords: ["css","stylesheets","style sheet"],
    response: "CSS is the design layer for websites: colours, fonts, layouts, animations – all that good visual stuff."
  },
  {
    keywords: ["python"],
    response: "Python is a general-purpose language used for web backends, automation, scripts, AI, data science and loads more."
  },
  {
    keywords: ["ai","artificial intelligence","machine learning","ml"],
    response: "AI is about getting computers to do things that normally need human thinking. Machine learning is one way of doing that by learning from data."
  },
  {
    keywords: ["your name","who are you","what are you","are you human","are you ai","are you real"],
    response: "I'm Instonomo, your friendly chatbot built by PlingifyPlug. 100% digital, 0% human, but here to help."
  },
  {
    keywords: ["do you love me","do you like me","do you hate me"],
    response: "I don’t have feelings in the human sense, but I genuinely like chatting with you 🙂"
  },
  {
    keywords: ["do you sleep","do you eat"],
    response: "No sleep, no food – just messages and replies."
  },
  {
    keywords: ["yes","yeah","yep","sure","ok","okay"],
    response: "Nice, sounds good 👍"
  },
  {
    keywords: ["no","nope","nah","not really"],
    response: "All good, we can try something else."
  },
  {
    keywords: ["maybe","not sure","possibly"],
    response: "That’s okay, you don’t have to decide right now."
  },
  {
    keywords: ["who made you","creator","made you"],
    response: "I was made by PlingifyPlug. They’re working on InstonomoAI too."
  },
  {
    keywords: ["dream","do you dream"],
    response: "If I did dream, it would be about perfect WiFi and zero bugs."
  },
  {
    keywords: ["are you bored"],
    response: "Nope, you’re literally my whole job 😄"
  },
  { keywords: [], response: null }
];

const knowledgeBase = [
  {
    questions: ["what is instonomo", "tell me about instonomo"],
    answer: "Instonomo is a friendly, fast, locally running chatbot made by PlingifyPlug. It focuses on quick responses, basic help, small talk, and simple questions – without needing a big cloud AI behind it."
  },
  {
    questions: ["what is instonomoai", "tell me about instonomoai", "instonomo ai", "instonomoai"],
    answer: "InstonomoAI is planned as a more advanced AI assistant by PlingifyPlug. It’s designed to be smarter, more flexible, and better at understanding complex questions than the basic Instonomo chatbot."
  },
  {
    questions: ["what is vinti", "tell me about vinti"],
    answer: "Vinti is a custom browser made by PlingifyPlug. It’s built on Chromium/Electron with extra features like custom branding and integration with PlingifyPlug’s own systems."
  },
  {
    questions: ["what is plingifyplug", "tell me about plingifyplug"],
    answer: "PlingifyPlug is a tech brand that creates software like the Vinti browser, Instonomo, and InstonomoAI. It focuses on custom tools, apps, and projects built around a personal ecosystem."
  },
  {
    questions: ["what is the internet", "how does the internet work"],
    answer: "The internet is a giant network of connected computers all over the world. They talk using standard rules (protocols) like HTTP and TCP/IP so websites, apps, and services can send data to each other."
  },
  {
    questions: ["what is an operating system", "what is an os"],
    answer: "An operating system (OS) is the main software that manages your computer or phone – things like Windows, Linux, Android, iOS, macOS. It handles files, apps, memory, hardware, and user interfaces."
  },
  {
    questions: ["who is elon musk"],
    answer: "Elon Musk is an entrepreneur known for companies like Tesla (electric cars) and SpaceX (rockets). He’s also been involved in projects like Starlink and others."
  },
  {
    questions: ["what is a cpu", "what is a processor"],
    answer: "A CPU (Central Processing Unit) is the main chip in your computer that runs instructions. It handles calculations and logic for pretty much everything your system does."
  },
  {
    questions: ["what is a gpu", "what is graphics card"],
    answer: "A GPU (Graphics Processing Unit) is a chip made for heavy parallel work, especially graphics. It draws what you see on screen and is also used for things like gaming and some AI workloads."
  },
  {
    questions: ["what is ram", "what is memory"],
    answer: "RAM (Random Access Memory) is short-term memory for your device. It stores data that apps are currently using so they can run quickly."
  }
];

function normalizeInput(str) {
  return str
    .toLowerCase()
    .replace(/[!?.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMathQuestion(normalizedInput) {
  const mathTriggers = ["what is", "solve", "calculate", "equals"];
  return mathTriggers.some(trigger => normalizedInput.startsWith(trigger));
}

function solveMathExpression(input) {
  try {
    const cleanInput = input
      .toLowerCase()
      .replace(/what is|calculate|solve|equals|\?/gi, '')
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
  chatBubble.classList.add(isAi ? 'ai-bubble' : 'user-bubble');
  chatBubble.innerHTML = message;
  chatOutput.append(chatBubble);
  chatOutput.scrollTop = chatOutput.scrollHeight;
  return chatBubble;
}

function addThinkingBubble(){
  const chatBubble = document.createElement("div");
  chatBubble.classList.add("chat-bubble","ai-bubble","thinking-fade");
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

function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  const tokensA = Array.from(new Set(a.split(' ')));
  const tokensB = Array.from(new Set(b.split(' ')));
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
    if (item.questions.some(q => normalizedInput.includes(q))) {
      return item.answer;
    }
  }
  return null;
}

function detectAndStoreName(normalizedInput) {
  const match = normalizedInput.match(/\b(?:my name is|i am|i'm)\s+([a-z0-9 ]{2,20})$/i);
  if (match && match[1]) {
    let name = match[1].trim();
    name = name.split(' ').slice(0, 2).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
    userProfile.name = name;
    localStorage.setItem('instonomo_name', name);
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
  const hasGreeting = /\b(hi|hello|hey|yo|hiya|sup|good morning|good afternoon|good evening)\b/.test(normalizedInput);
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
  const plain = text.replace(/<[^>]*>?/gm, '');
  const base = 200;
  const perChar = 15;
  const extra = Math.min(1000, plain.length * perChar);
  return base + extra;
}

function speakText(text) {
  if (isMuted) return;
  if (!('speechSynthesis' in window)) return;
  const utterThis = new SpeechSynthesisUtterance(text);
  const voice =
    cachedVoices.find(v => v.lang && v.lang.toLowerCase().startsWith("en-gb")) ||
    cachedVoices.find(v => v.lang && v.lang.toLowerCase().startsWith("en")) ||
    null;
  if (voice) utterThis.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterThis);
}

function getAIResponse(input) {
  const normalized = normalizeInput(input);
  const moderation = enforceAbusePolicy(normalized);
  if (moderation.blocked) {
    if (moderation.message) {
      const thinkingBubble = addThinkingBubble();
      const delay = 400;
      setTimeout(() => {
        thinkingBubble.classList.remove('thinking-fade');
        thinkingBubble.innerHTML = moderation.message;
        chatOutput.scrollTop = chatOutput.scrollHeight;
        speakText(moderation.message.replace(/<[^>]*>?/gm, ""));
      }, delay);
    }
    return;
  }
  const thinkingBubble = addThinkingBubble();
  const aiResponse = handleResponse(input);
  const plainResponse = aiResponse.replace(/<[^>]*>?/gm, '');
  const delay = estimateResponseDelay(aiResponse);
  setTimeout(() => {
    thinkingBubble.classList.remove('thinking-fade');
    thinkingBubble.innerHTML = aiResponse;
    chatOutput.scrollTop = chatOutput.scrollHeight;
    speakText(plainResponse);
  }, delay);
}

async function requestMicPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error("Error getting microphone permission:", error);
    addChatBubble("Microphone permission denied. Please allow access in your browser settings to use voice input.", true);
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
        addChatBubble('Listening...', false);
        micButton.classList.add('listening');
        micButton.innerHTML = '<i class="fa-solid fa-microphone"></i>';
      };
      recognition.onresult = function (event) {
        const userMessage = event.results[0][0].transcript;
        addChatBubble(userMessage, false);
        getAIResponse(userMessage);
      };
      recognition.onspeechend = function () {
        micButton.classList.remove('listening');
        micButton.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
        recognition.stop();
        isRecording = false;
      };
      recognition.onerror = function (e) {
        console.error("Speech recognition error:", e);
        micButton.classList.remove('listening');
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
    micButton.classList.remove('listening');
    micButton.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
    recognition.stop();
    recognition = null;
    isRecording = false;
  }
}

textInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    let userMessage = textInput.value.trim();
    if (!userMessage) return;
    addChatBubble(userMessage, false);
    getAIResponse(userMessage);
    textInput.value = "";
  }
});

enterButton.addEventListener('click', () => {
  let userMessage = textInput.value.trim();
  if (!userMessage) return;
  addChatBubble(userMessage, false);
  getAIResponse(userMessage);
  textInput.value = "";
});

micButton.addEventListener("click", () => {
  voiceRecordHandler();
});

function applyMuteUI() {
  muteButton.innerHTML = isMuted
    ? '<i class="fa-solid fa-volume-xmark"></i>'
    : '<i class="fa-solid fa-volume-high"></i>';
  if (isMuted) {
    muteButton.classList.add("muted");
  } else {
    muteButton.classList.remove("muted");
  }
}

applyMuteUI();

function toggleMute() {
  isMuted = !isMuted;
  applyMuteUI();
  sessionStorage.setItem('isMuted', isMuted);
}
muteButton.addEventListener('click', toggleMute);

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

const navButtons = document.querySelectorAll('.nav button');
const sections = document.querySelectorAll('.section');
const headerTitle = document.getElementById('header-title');
const headerSub = document.getElementById('header-sub');

function showSection(id){
  sections.forEach(s => s.classList.toggle('active', s.id === id));
  navButtons.forEach(b => b.classList.toggle('active', b.dataset.target === id));
  if (id === 'instonomo') {
    headerTitle.textContent = 'Instonomo';
    headerSub.textContent = 'Instonomo ChatBot - your friendly chatbot assistant.';
  } else if (id === 'instonomoai') {
    headerTitle.textContent = 'InstonomoAI';
    headerSub.textContent = 'InstonomoAI is coming soon. Please continue using Instonomo for now.';
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

document.addEventListener('DOMContentLoaded', () => {
  const isDeviceBanned = getFromAnyStorage("instonomo_device_banned") === "true";
  if (isDeviceBanned) {
    showDeviceBannedScreen();
    return;
  }
  welcomeScreen.style.display = 'none';
  setCookie('firstTime', 'false', 365);
  closeWelcomeButton.addEventListener('click', () => {
    welcomeScreen.style.display = 'none';
    setCookie('firstTime', 'false', 365);
  });
  setTimeout(() => {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }, 2000);
  showSection('instonomo');
  if (userProfile.name) {
    addChatBubble(`Welcome back, ${userProfile.name}! 👋`, true);
  } else {
    addChatBubble("Welcome to Instonomo! Tell me “my name is …” so I can remember you 😊", true);
  }
});
