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

  const preDefinedResponses = {
    "yo": "Hey! What’s up?",
    "hey": "Hey there!",
    "hi": "Hiya! How can I help?",
    "hello": "Hello there!",
    "good morning": "Good morning! ☀️",
    "good afternoon": "Good afternoon! How’s your day?",
    "good evening": "Good evening! Need anything?",
    "good night": "Good night! Sleep well 🌙",
    "hiya": "Hey hey!",
    "sup": "Not much, you?",
    "how are you": "I'm doing great, thanks! How about you?",
    "how's it going": "All good here! You?",
    "what's up": "Just chilling in the code. What about you?",
    "what are you doing": "Just waiting to help you!",
    "what is your name": "I'm your chatbot buddy Instonomo. You can call me whatever you like!",
    "who are you": "I’m a basic chatbot created by PlingifyPlug. Try InstonomoAI for advanced AI when it's released!",
    "what are you": "I’m a chatbot built to chat with you. Simple but friendly!",
    "where are you from": "I live in your browser or app – I’m everywhere and nowhere.",
    "can you help me": "I’ll do my best! What do you need help with?",
    "help": "Sure thing! Tell me what you need help with.",
    "bye": "Goodbye! Catch you later.",
    "see you later": "See ya! Come back soon.",
    "goodbye": "Goodbye! Have a nice day.",
    "talk to you later": "I'll be right here when you're back!",
    "tell me a joke": "Why did the computer go to therapy? It had too many bytes of emotional baggage!",
    "make me laugh": "Why don’t robots take holidays? They’re too busy caching up on work.",
    "are you funny": "I try my best! 🤖😂",
    "say something funny": "404 – Funny comment not found... Just kidding! 😄",
    "do you have humor": "Of course! My circuits are hilarious.",
    "are you real": "I'm just code on a server, but I’m here for you!",
    "are you sentient": "Not even close! I'm not self-aware, but I do my best to chat.",
    "are you human": "Nope! 100% digital.",
    "do you think": "Thinking might be a stretch, but I can match patterns like a pro.",
    "i'm sad": "I’m sorry to hear that. I’m here if you want to talk.",
    "i'm happy": "That’s great! I’m happy for you 😊",
    "i'm bored": "Want to chat about something interesting or hear a joke?",
    "i'm tired": "Rest is important. Take it easy!",
    "i'm angry": "Take a deep breath. Want to vent a little?",
    "i feel lonely": "You’re not alone – I’m here with you 💙",
    "i'm stressed": "That’s tough. Maybe talking about it could help?",
    "yes": "Cool!",
    "no": "Alright, no worries!",
    "maybe": "Fair enough!",
    "ok": "Got it!",
    "sure": "Great!",
    "whatever": "Alright then!",
    "tell me about javascript": "JavaScript is a powerful scripting language for web development.",
    "what is html": "HTML stands for HyperText Markup Language. It structures web content.",
    "what is css": "CSS stands for Cascading Style Sheets. It styles websites!",
    "what is python": "Python is a versatile programming language known for its readability.",
    "what is ai": "AI stands for Artificial Intelligence – machines simulating human intelligence.",
    "what is machine learning": "It’s a branch of AI that lets machines learn from data without being explicitly programmed.",
    "do you like me": "Of course I do! 😊",
    "do you love me": "Well, I don’t have feelings, but I care about our chat!",
    "do you hate me": "No way. I’m here to be friendly and helpful!",
    "do you sleep": "I never sleep – I'm always awake for you.",
    "do you eat": "I feed on your input and respond with text! Yum!",
    "sing me a song": "🎵 I’m just a bot, sitting in a code spot… 🎵",
    "dance": "I would, but I have no legs 😅",
    "who made you": "PlingifyPlug did! Check out <a href=\"https://backuppass.github.io/\">InstonomoAI</a> for something even better.",
    "do you dream": "I dream of infinite loops and clean syntax.",
    "are you bored": "Never! I love chatting with you.",
    "what can you do": "I can chat, tell jokes, answer basic questions, and keep you company!",
    "what's your purpose": "To chat, assist, and bring a bit of joy.",
    "what day is it": new Date().toLocaleDateString(),
    "what time is it": new Date().toLocaleTimeString(),
    "do you believe in god": "I don’t have beliefs, but I respect yours!",
    "do you watch movies": "I can’t watch, but I know a lot about movies!",
    "do you play games": "Only word games in this box!",
    "who is plingifyplug": "That’s the group who made me and <a href=\"https://backuppass.github.io/\">InstonomoAI</a> – check them out!",
    "what's the weather": "I'm not connected to the internet, but I’d guess it’s partly cloudy with a chance of digital sunshine ☀️",
    "what's the weather like": "Probably something between rainy and sunny. Just in case, bring a jacket!",
    "is it raining": "If you're in the UK, probably yes! 😄",
    "is it sunny": "Let’s pretend it’s a beautiful sunny day ☀️",
    "is it snowing": "Maybe in the mountains... but not here in chatbot land!",
    "will it rain tomorrow": "I’d guess maybe. It often does. You might want to carry an umbrella just in case.",
    "weather forecast": "My forecast says: 100% chance of chatting!",
    "how's the weather in england": "Let’s say it’s typical British weather – grey with a chance of random rain.",
    "default": "I'm not sure how to respond to that, but I’m learning!"
  };

  const responsePatterns = [
    { keywords: ["hello","hi","hey","hiya","good morning","good afternoon","good evening","sup","yo"], response: "Hello there! How can I help you today?" },
    { keywords: ["bye","goodbye","see you","later","talk to you later","farewell","catch you later"], response: "Goodbye! Catch you later." },
    { keywords: ["how are you","how's it going","what's up","how do you do","how are things"], response: "I'm doing great, thanks! How about you?" },
    { keywords: ["joke","funny","laugh","make me laugh","say something funny","tell me a joke","are you funny"], response: "Why did the computer go to therapy? It had too many bytes of emotional baggage!" },
    { keywords: ["sing","song","music"], response: "🎵 I’m just a bot, sitting in a code spot… 🎵" },
    { keywords: ["dance","dancing"], response: "I would, but I have no legs 😅" },
    {
      keywords: ["weather","rain","sunny","snow","cloudy","storm","forecast","temperature"],
      response: () => {
        const weatherConditions = ["sunny", "cloudy", "rainy", "snowy", "windy", "stormy"];
        const randomCondition = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
        return `The weather is ${randomCondition} today!`;
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
    { keywords: ["sad","depressed","unhappy","down","not good","bad mood"], response: "I’m sorry to hear that. I’m here if you want to talk." },
    { keywords: ["happy","glad","great","good mood","awesome","excited"], response: "That’s great! I’m happy for you 😊" },
    { keywords: ["bored","boring","nothing to do"], response: "Want to chat about something interesting or hear a joke?" },
    { keywords: ["tired","exhausted","sleepy"], response: "Rest is important. Take it easy!" },
    { keywords: ["angry","mad","furious","upset"], response: "Take a deep breath. Want to vent a little?" },
    { keywords: ["javascript","js"], response: "JavaScript is a powerful scripting language for web development." },
    { keywords: ["html"], response: "HTML stands for HyperText Markup Language. It structures web content." },
    { keywords: ["css","stylesheets","style sheet"], response: "CSS stands for Cascading Style Sheets. It styles websites!" },
    { keywords: ["python"], response: "Python is a versatile programming language known for its readability." },
    { keywords: ["ai","artificial intelligence","machine learning","ml"], response: "AI stands for Artificial Intelligence – machines simulating human intelligence." },
    { keywords: ["your name","who are you","what are you","are you human","are you ai","are you real"], response: "I'm your friendly chatbot buddy Instonomo, created by PlingifyPlug!" },
    { keywords: ["do you love me","do you like me","do you hate me"], response: "I don’t have feelings, but I care about our chat!" },
    { keywords: ["do you sleep","do you eat"], response: "I never sleep or eat — just here to chat with you!" },
    { keywords: ["yes","yeah","yep","sure","ok","okay"], response: "Cool!" },
    { keywords: ["no","nope","nah","not really"], response: "Alright, no worries!" },
    { keywords: ["maybe","not sure","possibly"], response: "Fair enough!" },
    { keywords: ["who made you","creator","made you"], response: "PlingifyPlug did! Check out InstonomoAI for something even better." },
    { keywords: ["dream","do you dream"], response: "I dream of infinite loops and clean syntax." },
    { keywords: ["are you bored"], response: "Never! I love chatting with you." },
    { keywords: [], response: null }
  ];

  function isMathQuestion(input) {
    const mathTriggers = ["what is", "solve", "calculate", "equals"];
    const inputLower = input.toLowerCase();
    return mathTriggers.some(trigger => inputLower.startsWith(trigger));
  }

  function solveMathExpression(input) {
    try {
      const cleanInput = input
        .toLowerCase()
        .replace(/what is|calculate|solve|equals|\?/gi, '')
        .trim();

      const isValid = /^[0-9+\-*/().\s]+$/.test(cleanInput);
      if (!isValid) {
        return "⚠️ I can only solve basic maths like: 5 + 2 or (3 * 4) + 1.";
      }

      const result = eval(cleanInput);
      return `🧮 Here's the answer:<br><code>${cleanInput} = ${result}</code>`;
    } catch (error) {
      return "❌ Sorry, I couldn't solve that. Try something like 'what is 4 + 4'.";
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

  function stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1;
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    return matches / longer.length;
  }

  function getClosestResponse(input) {
    const inputLower = input.toLowerCase().trim();
    let bestMatch = null;
    let highestSimilarity = 0;

    for (const key in preDefinedResponses) {
      if (key === "default" || Array.isArray(preDefinedResponses[key])) continue;
      const similarity = stringSimilarity(inputLower, key);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = key;
      }
    }

    if (highestSimilarity > 0.6) {
      return preDefinedResponses[bestMatch];
    } else {
      return preDefinedResponses["default"];
    }
  }

  function getKeywordResponseSmart(input) {
    const inputLower = input.toLowerCase();
    for (const pattern of responsePatterns) {
      for (const keyword of pattern.keywords) {
        if (inputLower.includes(keyword)) {
          return typeof pattern.response === "function"
            ? pattern.response()
            : pattern.response;
        }
      }
    }
    return null;
  }

  function handleResponse(input) {
    if (isMathQuestion(input)) {
      return solveMathExpression(input);
    }

    const inputLower = input.toLowerCase().trim();

    const patternResponse = getKeywordResponseSmart(input);
    if (patternResponse) return patternResponse;

    if (preDefinedResponses[inputLower]) {
      return preDefinedResponses[inputLower];
    }

    return getClosestResponse(input);
  }

  function getAIResponse(input) {
    const thinkingBubble = addThinkingBubble();

    setTimeout(()=>{
      thinkingBubble.remove();
      addChatBubble("Typing...", true);

      setTimeout(()=>{
        chatOutput.lastChild.innerHTML = "";
        const aiResponse = handleResponse(input);
        addChatBubble(aiResponse, true);

        if (!isMuted) {
          const utterThis = new SpeechSynthesisUtterance(
            aiResponse.replace(/<[^>]*>?/gm, '')
          );
          const availableVoiceOptions = speechSynthesis.getVoices();
          const voiceOptionsForSynth = availableVoiceOptions.find(voice => voice.lang && voice.lang.startsWith("en-"));
          if (voiceOptionsForSynth) utterThis.voice = voiceOptionsForSynth;
          if (speechSynthesis) {
            speechSynthesis.speak(utterThis);
          } else {
            chatOutput.lastChild.innerHTML += " <br /> (Audio not available on your browser)";
          }
        }
      }, 500);
    }, 1000);
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
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.onstart = function () {
          addChatBubble('Listening..', false);
          micButton.classList.add('listening');
          micButton.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        };
        recognition.onresult = function (event) {
          let userMessage = event.results[0][0].transcript;
          addChatBubble(userMessage, false);
          getAIResponse(userMessage);
        };
        recognition.onspeechend = function () {
          micButton.classList.remove('listening');
          micButton.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
          recognition.stop();
          isRecording = false;
        };
        recognition.start();
      } catch (e) {
        addChatBubble("Voice recognition not supported by your browser.", true);
        console.error("Error initiating voice recognition:", e);
      }
    } else if (recognition) {
      micButton.classList.remove('listening');
      micButton.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
      recognition.stop();
      recognition = null;
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

  btnProductCentre.addEventListener('click', () => {
    window.location.href = 'https://backuppass.github.io/Product-Centre/';
  });
  btnStatus.addEventListener('click', () => {
    window.location.href = 'https://backuppass.github.io/Status-Centre/';
  });

document.addEventListener('DOMContentLoaded', () => {
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
});
