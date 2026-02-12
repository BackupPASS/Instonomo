import { detectIntent } from "./intents.js";
import { loadMemory, saveMemory } from "./memory.js";

import * as skillSmalltalk from "./skills/smalltalk.js";
import * as skillMath from "./skills/math.js";
import * as skillFallback from "./skills/fallback.js";

const SKILLS = [skillSmalltalk, skillMath, skillFallback];

function resolveAwaiting(memory, rawText) {
  const t = String(rawText ?? "").trim().toLowerCase();

  if (memory.convo.awaiting === "bored.choice") {
    if (/\bjoke\b/.test(t)) {
      memory.convo.awaiting = null;
      memory.preferences.preferredBoredOption = "joke";
      memory.habits.jokeCount = (memory.habits.jokeCount || 0) + 1;
      return { replyHtml: "Why don’t robots take holidays? They’re too busy <i>caching</i> up on work 😄" };
    }
    if (/\bquiz\b/.test(t)) {
      memory.convo.awaiting = null;
      memory.preferences.preferredBoredOption = "quiz";
      return { replyHtml: "Quick quiz: What does <b>CPU</b> stand for? 🤔" };
    }
    if (/\btech\b/.test(t)) {
      memory.convo.awaiting = null;
      memory.preferences.preferredBoredOption = "tech";
      return { replyHtml: "Tech chat it is. What are you building right now - website, app, or something in Vinti?" };
    }
    return null;
  }

  if (memory.convo.awaiting === "weather.location") {
    const when = memory.convo.context?.when || "today";
    memory.convo.awaiting = null;

    const conditions = ["sunny", "cloudy", "rainy", "windy", "chilly", "a bit mixed"];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];

    return { replyHtml: `For <b>${t}</b> ${when}, I’d guess <b>${condition}</b> (no live data though).` };
  }

  return null;
}

export function createEngine() {
  const memory = loadMemory();

  function handle(rawText) {
    const awaitingReply = resolveAwaiting(memory, rawText);
    if (awaitingReply) {
      saveMemory(memory);
      return awaitingReply.replyHtml;
    }

    const intent = detectIntent(rawText);
    memory.convo.lastIntent = intent.name;
    memory.convo.lastUserMessageAt = Date.now();

    for (const s of SKILLS) {
      if (s.canHandle(intent.name)) {
        const out = s.handle({ rawText, intent, memory });
        if (out?.replyHtml) {
          saveMemory(memory);
          return out.replyHtml;
        }
      }
    }

    saveMemory(memory);
    return "Hmm… something went wrong.";
  }

  return { handle };
}
