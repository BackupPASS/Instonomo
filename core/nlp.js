export function normalizeInput(str) {
  return String(str ?? "")
    .toLowerCase()
    .replace(/[!?.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(normalized) {
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

export function hasAnyWord(normalized, words) {
  return words.some(w => normalized.includes(w));
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
