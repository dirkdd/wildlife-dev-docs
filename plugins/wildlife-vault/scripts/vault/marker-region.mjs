// scripts/vault/marker-region.mjs
export const BEGIN = "<!-- vault-map:begin -->";
export const END = "<!-- vault-map:end -->";

export function replaceMarkedRegion(content, generated) {
  if (generated.includes(BEGIN) || generated.includes(END)) {
    throw new Error("generated content contains vault-map marker strings");
  }
  const b = content.indexOf(BEGIN);
  const e = content.indexOf(END);
  if (b === -1 || e === -1 || e < b) {
    throw new Error("vault-map markers not found or malformed");
  }
  const before = content.slice(0, b + BEGIN.length);
  const after = content.slice(e);
  return `${before}\n${generated}\n${after}`;
}
