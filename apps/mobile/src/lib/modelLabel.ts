// Brand words the provider icon already shows. A label that opens with one of
// them leads with the model family and version instead, e.g. "Opus 5.5".
const ICON_BRAND_PREFIXES = ["Anthropic", "Claude", "Google", "OpenAI", "Meta", "Microsoft", "xAI"];

/** Label for a model shown beside its provider icon, without the redundant brand. */
export function modelLabelBesideIcon(label: string): string {
  let rest = label.trim();
  for (;;) {
    const brand = ICON_BRAND_PREFIXES.find(
      (prefix) => rest.startsWith(`${prefix} `) && rest.length > prefix.length + 1,
    );
    if (!brand) return rest;
    rest = rest.slice(brand.length + 1).trimStart();
  }
}
