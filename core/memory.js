const KEY = "instonomo_memory_v1";

export function loadMemory() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultMemory();
    const obj = JSON.parse(raw);
    return { ...defaultMemory(), ...obj };
  } catch {
    return defaultMemory();
  }
}

export function saveMemory(memory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {}
}

export function defaultMemory() {
  return {
    profile: {
      name: localStorage.getItem("instonomo_name") || null,
    },
    preferences: {

    },
    facts: {
    },
    habits: {
      boredomCount: 0,
      jokeCount: 0,
    },
    convo: {
      awaiting: null,     
      context: {},      
      lastIntent: null,
      lastUserMessageAt: 0
    }
  };
}
