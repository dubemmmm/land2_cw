// SVG fill patterns for confidence. Include once inside any <svg> that uses
// fill="url(#sq-hatch-…)" . `id` keeps pattern ids unique per drawing.
export default function PatternDefs({ id = "sq", color = "currentColor" }) {
  return (
    <defs>
      <pattern id={`${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth="1.6" />
      </pattern>
      <pattern id={`${id}-dot`} width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.1" fill={color} />
      </pattern>
    </defs>
  );
}

export function patternFill(pattern, id = "sq", solid = "currentColor") {
  if (pattern === "solid") return solid;
  if (pattern === "hatch") return `url(#${id}-hatch)`;
  if (pattern === "dot") return `url(#${id}-dot)`;
  return "none";
}
