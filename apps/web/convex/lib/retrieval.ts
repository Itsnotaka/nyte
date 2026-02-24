export const COMMAND_KNOWLEDGE_VECTOR_DIMENSIONS = 64;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9@._/\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function embedTextForSearch(text: string): number[] {
  const vector = Array.from(
    { length: COMMAND_KNOWLEDGE_VECTOR_DIMENSIONS },
    () => 0
  );
  const normalized = normalize(text);
  if (normalized.length === 0) {
    return vector;
  }

  const tokens = normalized.split(" ");
  for (const token of tokens) {
    if (!token) {
      continue;
    }
    const hashed = hashToken(token);
    const slot = hashed % COMMAND_KNOWLEDGE_VECTOR_DIMENSIONS;
    const sign = (hashed & 1) === 0 ? 1 : -1;
    const weight = 1 + (token.length % 7) * 0.1;
    vector[slot] += sign * weight;
  }

  let magnitude = 0;
  for (const value of vector) {
    magnitude += value * value;
  }
  if (magnitude === 0) {
    return vector;
  }
  const scale = Math.sqrt(magnitude);
  return vector.map((value) => value / scale);
}

export function scoreKeywordOverlap(input: string, candidate: string): number {
  const leftTokens = new Set(normalize(input).split(" ").filter(Boolean));
  const rightTokens = new Set(normalize(candidate).split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}
