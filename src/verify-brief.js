/** Node port of impact/verify_brief.py. It checks numeric traceability, not factual accuracy. */
const ignoredNumbers = [
  /\d{4}-\d{2}-\d{2}/g,
  /\b(?:H\.R\.|S\.|H\.J\.Res\.|S\.J\.Res\.)\s?\d+/g,
  /\bUL \d+/g, /\bSec(?:tion|\.)\s?\d+[\w()]*/g,
  /\b\d{1,3}(?:st|nd|rd|th)\b/g,
  /\b(?:19|20)\d{2}\b/g,
  /\b[A-Z]{1,4}-?\d+\b/g,
];
const money = /\$\s?(\d[\d,]*(?:\.\d+)?)\s?([KMB])?\b/gi;
const percent = /(\d+(?:\.\d+)?)\s?%/g;
const number = /(?<![\w.])(\d[\d,]*(?:\.\d+)?)(?![\w%])/g;
const scales = { K: 1e3, M: 1e6, B: 1e9 };

function* leaves(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) yield* leaves(child);
  } else {
    yield value;
  }
}

function collectNumbers(sources) {
  const allowed = new Set();
  for (const value of leaves(sources)) {
    if (typeof value === 'number') allowed.add(value);
    if (typeof value === 'string') {
      for (const match of value.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)) {
        allowed.add(Number(match[0].replaceAll(',', '')));
      }
    }
  }
  return [...allowed];
}

function halfUnit(text, scale = 1) {
  const decimals = text.includes('.') ? text.split('.')[1].length : 0;
  return 0.5 * 10 ** -decimals * scale;
}

function matches(value, tolerance, allowed) {
  return allowed.some(reference => Math.abs(Math.abs(reference) - value) <= tolerance + 1e-9);
}

export function verifyBrief(brief, sources) {
  const allowed = collectNumbers(sources);
  const allowedPercent = [...allowed, ...allowed.filter(value => Math.abs(value) <= 1).map(value => value * 100)];
  const problems = [];
  for (const original of leaves(brief)) {
    if (typeof original !== 'string') continue;
    let text = original;
    for (const pattern of ignoredNumbers) text = text.replace(pattern, ' ');
    for (const match of text.matchAll(money)) {
      const scale = scales[match[2]?.toUpperCase()] || 1;
      const value = Number(match[1].replaceAll(',', '')) * scale;
      if (!matches(value, halfUnit(match[1], scale), allowed)) problems.push([match[0], original]);
    }
    text = text.replace(money, ' ');
    for (const match of text.matchAll(percent)) {
      if (!matches(Number(match[1]), halfUnit(match[1]), allowedPercent)) problems.push([match[0], original]);
    }
    text = text.replace(percent, ' ');
    for (const match of text.matchAll(number)) {
      const value = Number(match[1].replaceAll(',', ''));
      if (value <= 12 && Number.isInteger(value)) continue;
      if (!matches(value, halfUnit(match[1]), allowed)) problems.push([match[0], original]);
    }
  }
  return { numbers_trace_to_inputs: problems.length === 0, problems };
}
