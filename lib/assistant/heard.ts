export function fixHeard(text: string) {
  return text.normalize('NFC').replace(/\b(?:uday an|udayan cinemas?)\b/gi, 'Udayan')
    .replace(/\b(?:sheora phuli|sheorafuli|seoraphuli)\b/gi, 'Sheoraphuli')
    .replace(/\b(?:tarak eswar|tarkeshwar|tarakeshwar)\b/gi, 'Tarakeswar')
    .replace(/\bd p d\b/gi, 'DPD').trim();
}
