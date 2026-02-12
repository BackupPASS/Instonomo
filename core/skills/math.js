export function canHandle(intentName) {
  return intentName === "math.solve";
}

export function handle({ rawText }) {
  try {
    const cleanInput = String(rawText)
      .toLowerCase()
      .replace(/what is|calculate|solve|equals|\?/gi, "")
      .trim();

    const isValid = /^[0-9+\-*/().\s]+$/.test(cleanInput);
    if (!isValid) {
      return { replyHtml: "⚠️ I can only solve basic maths like: <code>5 + 2</code> or <code>(3 * 4) + 1</code>." };
    }

    const result = eval(cleanInput);

    if (Number.isNaN(result)) {
      return { replyHtml: "❌ I couldn’t work that out. Try something like <code>4 + 4</code>." };
    }

    return { replyHtml: `🧮 Here's the answer:<br><code>${cleanInput} = ${result}</code>` };
  } catch {
    return { replyHtml: "❌ Sorry, I couldn't solve that. Try something like <code>what is 4 + 4</code>." };
  }
}
