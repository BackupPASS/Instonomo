import { normalizeInput } from "./nlp.js";

export function detectIntent(rawText) {
  const text = String(rawText ?? "").trim();
  const n = normalizeInput(text);

  if (/\b(hi|hello|hey|yo|hiya|sup|good morning|good afternoon|good evening)\b/.test(n)) {
  return {
    name: "smalltalk.greeting",
    confidence: 0.95,
    slots: {}
  };
}

  {
    const m = n.match(/\b(?:my name is|i am|i'm)\s+([a-z0-9 ]{2,20})$/i);
    if (m?.[1]) {
      return {
        name: "profile.set_name",
        confidence: 0.95,
        slots: { name: m[1].trim() }
      };
    }
  }

  if (/\b(i'?m bored|im bored|bored)\b/.test(n)) {
    return { name: "mood.bored", confidence: 0.9, slots: {} };
  }

  if (/\b(weather|forecast|rain|sunny|snow)\b/.test(n)) {
    const loc =
      (n.match(/\b(?:in|for)\s+([a-z ]{3,30})$/i)?.[1] || "").trim() || null;

    const when =
      (n.match(/\b(today|tomorrow|tonight|this weekend)\b/i)?.[1] || "").trim() || null;

    return {
      name: "info.weather",
      confidence: 0.7,
      slots: { location: loc, when }
    };
  }

  if (/^(what is|solve|calculate)\b/.test(n) && /[0-9]/.test(n)) {
    return { name: "math.solve", confidence: 0.85, slots: {} };
  }

  return { name: "fallback.unknown", confidence: 0.2, slots: {} };
}
