import type { ProviderOptionDescriptor } from "@t3tools/contracts";

import type { ComposerControlSize } from "./ComposerControl";

const GLYPH_HEIGHT_SM = 18;
const GLYPH_HEIGHT_XS = 16;
// Bars stop this far above the box's bottom, which puts their flat base on the text baseline.
const BASELINE_INSET = 2;

const NAMED_LEVELS = new Set(["ultra", "ultracode", "ultrathink"]);
const OFF_LEVELS = new Set(["off", "none"]);

/**
 * One bar per reasoning level; binary thinking lights the whole scale or none of it.
 * Prompt-injected and named modes keep their labels.
 */
export function resolveEffortGlyph(
  descriptor: ProviderOptionDescriptor,
  current: string | boolean | null,
) {
  if (descriptor.type === "boolean") {
    return typeof current === "boolean"
      ? {
          count: 3,
          filled: current ? 3 : 0,
          special: null,
          label: `${descriptor.label} ${current ? "On" : "Off"}`,
        }
      : null;
  }
  if (typeof current !== "string") return null;
  const special = new Set([...(descriptor.promptInjectedValues ?? []), ...NAMED_LEVELS]);
  const levels = descriptor.options.filter((option) => !special.has(option.id));
  if (levels.length < 2) return null;
  const startsAtOff = OFF_LEVELS.has(levels[0]!.id);
  const binary = startsAtOff && levels.length === 2;
  const count = binary ? 3 : startsAtOff ? levels.length - 1 : levels.length;
  if (special.has(current)) {
    const label = descriptor.options.find((option) => option.id === current)?.label ?? current;
    return { count, filled: count, special: label, label };
  }
  const index = levels.findIndex((option) => option.id === current);
  if (index < 0) return null;
  return {
    count,
    filled: binary ? index * count : startsAtOff ? index : index + 1,
    special: null,
    label: levels[index]!.label,
  };
}

/** Bar heights that rise by one whole-pixel step, from about half height up to `maxBar`. */
export function effortBarHeights(count: number, maxBar: number): number[] {
  // Rounding each bar separately mixes 1px and 2px steps, so round the step once.
  const step = Math.max(1, Math.round(maxBar / 2 / Math.max(count - 1, 1)));
  return Array.from({ length: count }, (_, index) => maxBar - (count - 1 - index) * step);
}

/**
 * Rising bars on whole pixels so they stay sharp on 1x displays. Color follows the text.
 * The box is centered like the icons beside it; the bars sit on the text baseline inside it.
 */
export function EffortGlyph(props: { count: number; filled: number; size?: ComposerControlSize }) {
  const height = props.size === "xs" ? GLYPH_HEIGHT_XS : GLYPH_HEIGHT_SM;
  const step = 5;
  const barWidth = 3;
  const barsWidth = step * (props.count - 1) + barWidth;
  const width = Math.max(24, barsWidth);
  const inset = Math.floor((width - barsWidth) / 2);
  const maxBar = height - BASELINE_INSET;
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      // Inline size: the composer control CSS forces unsized SVGs to 16px.
      style={{ width, height }}
      className="shrink-0 text-current"
      data-composer-effort-glyph
      // Opts out of the control's negative icon margins, so the row's gaps stay true.
      data-composer-control-icon
    >
      {effortBarHeights(props.count, maxBar).map((barHeight, index) => {
        const x = inset + index * step;
        return (
          <rect
            key={x}
            x={x}
            y={maxBar - barHeight}
            width={barWidth}
            height={barHeight}
            fill="currentColor"
            opacity={index < props.filled ? 1 : 0.25}
          />
        );
      })}
    </svg>
  );
}
