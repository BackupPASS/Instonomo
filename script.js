const chatOutput = document.getElementById('chat-output');
const textInput = document.getElementById("text-input");
const micButton = document.getElementById('mic-button');
const muteButton = document.getElementById('mute-button');
const enterButton = document.getElementById('enter-button');
const welcomeScreen = document.getElementById('welcome-screen');
const closeWelcomeButton = document.getElementById('close-welcome');
const themeButton = document.getElementById('theme-button'); // Add the theme button element
const loadingScreen = document.getElementById('loading-screen'); // loading screen

let isRecording = false;
let recognition;
let isMuted = sessionStorage.getItem('isMuted') === 'true' || false;
let isDarkMode = localStorage.getItem('isDarkMode') === 'true' || false;  // Track dark mode state
const preDefinedResponses = {
    "yo": "Hello there!",
    "hey": "Hello there!",
    "hi": "Hello there!",
    "hello": "Hey there!",
    "how are you": "I am fine, thank you. How can I help?",
    "who are you": "I am just a very basic chatbot, not a real AI. PlingifyPlug have another services called InstonomoAI which is a paid AI",
    "bye": "Goodbye, See you soon!",
    "help": "I can try my best to help! what do you need?",
    "tell me about javascript": "Javascript is a very popular scripting language used on many websites!",
    "default": "I'm sorry but I'm not sure how to respond to that."
};


// Function to apply dark mode styles
function applyDarkMode() {
    document.body.classList.add('dark-mode');
    themeButton.innerHTML = '<i class="fas fa-moon"></i>';
    localStorage.setItem('isDarkMode', 'true'); // Save dark mode state
}

// Function to apply light mode styles
function applyLightMode() {
    document.body.classList.remove('dark-mode');
    themeButton.innerHTML = '<i class="fas fa-sun"></i>';
    localStorage.setItem('isDarkMode', 'false');  // Save light mode state
}

// Function to toggle dark mode
function toggleTheme() {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
        applyDarkMode()
    } else {
        applyLightMode()
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
    chatBubble.classList.add("chat-bubble");
    chatBubble.classList.add('ai-bubble');
    chatBubble.classList.add('thinking-fade');

    chatBubble.innerHTML = `
    <div class="dots-container">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
    </div>
    `;
    chatOutput.append(chatBubble);
      chatOutput.scrollTop = chatOutput.scrollHeight;

     return chatBubble
}

function getClosestResponse(input) {
    const inputLower = input.toLowerCase().trim();
    let bestMatch = null;
    let highestSimilarity = 0;

    for (const key in preDefinedResponses) {
        if (key === "default" || Array.isArray(preDefinedResponses[key])) {
            continue;
        }
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

function stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
        return 1
    }
    let matches = 0;

    for (let i = 0; i < shorter.length; i++) {
        if (longer.includes(shorter[i])) {
            matches++
        }
    }

    return matches / longer.length
}


function getKeywordResponse(input) {
    const inputLower = input.toLowerCase().trim();
    const keywords = {
        "weather": () => {
            const weatherConditions = ["sunny", "cloudy", "rainy", "snowy", "windy"];
            const randomCondition = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
            return `The weather is ${randomCondition} today!`

        },
        "time": () => {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            return `The time is ${hours}:${minutes < 10 ? '0' : ''}${minutes}.`;
        },
        "date": () => {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            return `Today is ${now.toLocaleDateString(undefined, options)}.`
        }
    };
    for (const keyword in keywords) {
        if (inputLower.includes(keyword)) {
            return keywords[keyword]()
        }
    }

    return null;
}

function handleResponse(input) {
    const inputLower = input.toLowerCase().trim();
    const keywordResponse = getKeywordResponse(input);
    if (keywordResponse) {
        return keywordResponse;
    }
    if (preDefinedResponses[inputLower]) {
        return preDefinedResponses[inputLower];
    } else {
        return getClosestResponse(inputLower);
    }
}


function getAIResponse(input) {
  const thinkingBubble = addThinkingBubble()

     setTimeout(()=>{
         thinkingBubble.remove()
         addChatBubble("Typing...", true);

        setTimeout(()=>{
             chatOutput.lastChild.innerHTML = "";
             const aiResponse = handleResponse(input);
             addChatBubble(aiResponse, true);
          if (!isMuted) {
            const utterThis = new SpeechSynthesisUtterance(aiResponse);
            const availableVoiceOptions = speechSynthesis.getVoices()
            const voiceOptionsForSynth = availableVoiceOptions.find(voice => voice.lang.startsWith("en-US"))
                if (voiceOptionsForSynth) {
                utterThis.voice = voiceOptionsForSynth;
            }
            if (speechSynthesis) {
                speechSynthesis.speak(utterThis);
            } else {
                chatOutput.lastChild.innerHTML += " <br /> (Audio not available on your browser)"
            }
        }
        }, 500)
        }, 1000)
}

async function requestMicPermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;

    } catch (error) {
        console.error("Error getting microphone permission:", error);
        addChatBubble("Microphone permission denied. Please allow access in your browser settings to use voice input.", true)
        return false;

    }
}


async function voiceRecordHandler() {
    if (!recognition) {
        const hasPermission = await requestMicPermission()
        if (!hasPermission) return

        try {
            recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            recognition.onstart = function () {
                addChatBubble('Listening..', false);
                micButton.classList.add('listening');
                micButton.innerHTML = '<i class="fas fa-microphone"></i>'
            };
            recognition.onresult = function (event) {
                let userMessage = event.results[0][0].transcript;
                addChatBubble(userMessage, false);
                getAIResponse(userMessage);
            };
            recognition.onspeechend = function () {
                micButton.classList.remove('listening');
                micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>'
                recognition.stop();
                isRecording = false;
            };
            recognition.start();

        } catch (e) {
            addChatBubble("Voice recognition not supported by your browser.", true)
            console.error("Error initiating voice recognition:", e)
        }
    } else if (recognition) {
        micButton.classList.remove('listening');
        micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>'
        recognition.stop();
        recognition = null;
    }
}


textInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
        let userMessage = textInput.value.trim();
        addChatBubble(userMessage, false);
        getAIResponse(userMessage);
        textInput.value = "";
    }
});

enterButton.addEventListener('click', () => {
    let userMessage = textInput.value.trim();
    addChatBubble(userMessage, false);
    getAIResponse(userMessage);
    textInput.value = "";
})

micButton.addEventListener("click", () => {
    voiceRecordHandler();
});

muteButton.innerHTML = isMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
if (isMuted) {
    muteButton.classList.add("muted");
} else {
    muteButton.classList.remove("muted");
}

function toggleMute() {
    isMuted = !isMuted;
    muteButton.innerHTML = isMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
    if (isMuted) {
        muteButton.classList.add("muted");
    } else {
        muteButton.classList.remove("muted");
    }
    sessionStorage.setItem('isMuted', isMuted);
}

muteButton.addEventListener('click', toggleMute);


function checkSpeed() {
    var testImageUrl = 'image2.jpg';
    var startTime, endTime;

    function speedTest() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', testImageUrl, true);
        xhr.responseType = 'blob';

        xhr.onloadstart = function () {
            startTime = new Date().getTime();
        };

        xhr.onload = function () {
            endTime = new Date().getTime();
            var duration = (endTime - startTime) / 1000; // seconds
            var fileSize = xhr.response.size / 1024 / 1024; // MB
            var speedMbps = (fileSize * 2) / duration; // Mbps

            if (speedMbps < 2) {
                window.location.href = 'https://backuppass.github.io/Slow-Wifi';
            }
        };

        xhr.send();
    }
    speedTest();
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


document.addEventListener('DOMContentLoaded', () => {
        // Set initial theme based on localStorage, or light mode if no local storage is set
    if (isDarkMode) {
        applyDarkMode();
    } else {
        applyLightMode();
    }

    const isFirstTime = getCookie('firstTime') === null;

    if (isFirstTime) {
        welcomeScreen.style.display = 'flex';
    }

    closeWelcomeButton.addEventListener('click', () => {
        welcomeScreen.style.display = 'none';
        setCookie('firstTime', 'false', 365); // Set cookie for 1 year

    });
    checkSpeed();


    const banExpiry = getCookie('banExpiry');

    if (banExpiry && new Date().getTime() < parseInt(banExpiry)) {

        window.location.href = 'https://backuppass.github.io/Pass-Banning-System-Token.InstonomoAI.2025//';
        return;
    } else if (banExpiry) {
        setCookie('banExpiry', "", -1)
    }

    let accessTimes = JSON.parse(localStorage.getItem('accessTimes') || '[]');
    const currentTime = new Date().getTime();

    accessTimes = accessTimes.filter(time => currentTime - time < 60000);

    if (accessTimes.length >= 5) {
        const banDuration = 60 * 1000;
        const banEndTime = new Date().getTime() + banDuration;
        setCookie('banExpiry', banEndTime, 1 / 1440);
        console.log("Ban triggered!");
    }

    accessTimes.push(currentTime);
    localStorage.setItem('accessTimes', JSON.stringify(accessTimes));
    console.log("Access recorded at:", currentTime, "Current Access Times:", accessTimes);
    // Loading animation fade-out
    setTimeout(() => {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500); // Wait for the fade-out transition to complete
    }, 2000); // Display for 2 seconds
});
themeButton.addEventListener('click', toggleTheme);
