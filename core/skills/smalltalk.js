export function canHandle(intentName) {
  return intentName === "profile.set_name" ||
         intentName === "mood.bored" ||
         intentName === "info.weather" ||
         intentName === "smalltalk.greeting";
}

function titleCaseName(name) {
  return String(name)
    .trim()
    .split(" ")
    .slice(0, 2)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function handle({ intent, memory }) {

  if (intent.name === "smalltalk.greeting") {
    const name = memory.profile.name;
    if (name) {
      return { replyHtml: `Hey ${name}! 👋 What can I help you with today?` };
    }
    return { replyHtml: "Hey there! 👋 How can I help?" };
  }

  if (intent.name === "profile.set_name") {
    const name = titleCaseName(intent.slots.name || "");
    if (!name) return { replyHtml: "What should I call you?" };

    memory.profile.name = name;
    try { localStorage.setItem("instonomo_name", name); } catch {}

    return { replyHtml: `Nice to meet you, ${name}! I’ll remember your name for next time 😊` };
  }

  if (intent.name === "mood.bored") {
    memory.habits.boredomCount = (memory.habits.boredomCount || 0) + 1;

    const pref = memory.preferences.preferredBoredOption;
    if (pref) {
      return { replyHtml: `Want a quick ${pref} again, or something different? (joke / quiz / tech)` };
    }

    memory.convo.awaiting = "bored.choice";
    memory.convo.context = { options: ["joke", "quiz", "tech"] };

    const name = memory.profile.name ? ` ${memory.profile.name}` : "";
    return {
      replyHtml:
        `Alright${name} - pick one: <b>joke</b>, <b>quiz</b>, or <b>tech chat</b>?`
    };
  }

  if (intent.name === "info.weather") {
    const { location, when } = intent.slots || {};
    const conditions = ["sunny", "cloudy", "rainy", "windy", "chilly", "a bit mixed"];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];

    if (!location) {
      memory.convo.awaiting = "weather.location";
      memory.convo.context = { when: when || "today" };
      return { replyHtml: `I can guess, but where abouts? (e.g. “in London”)` };
    }

    const whenText = when ? when : "today";
    return { replyHtml: `I don’t have live data, but for <b>${location}</b> ${whenText}, I’d guess it’ll be <b>${condition}</b>.` };
  }

  return null;
}
