export function canHandle() {
  return true;
}

export function handle({ memory }) {
  if (memory.convo.awaiting === "bored.choice") {
    return { replyHtml: `Just say: <b>joke</b>, <b>quiz</b>, or <b>tech</b>.` };
  }

  if (memory.convo.awaiting === "weather.location") {
    return { replyHtml: `Tell me a location like: “weather in London 🙂` };
  }

  return { replyHtml: "I’m not fully sure what you mean yet - can you rephrase it in a different way?" };
}
