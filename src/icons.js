// Inline animated SVG weather icons. Their motion lives in styles.css under `.wi`.

const CLOUD = "M20 46h26a10 10 0 0 0 1-19.9A14 14 0 0 0 20.4 24 11 11 0 0 0 20 46z";
const MOON = "M42 12a20 20 0 1 0 10 30 16 16 0 0 1-10-30z";
const STAR = "M0-5l1.2 3.8L5 0 1.2 1.2 0 5-1.2 1.2-5 0-1.2-3.8z";
const BOLT = "M33 42l-7 11h6l-3 10 10-13h-6l4-8z";

const LIGHT = "#f1f5f9";
const GREY = "#cbd5e1";
const DARK = "#64748b";

const cloud = (fill, transform) => `<path d="${CLOUD}" fill="${fill}"${transform ? ` transform="${transform}"` : ""}/>`;

function sun(cx, cy, r) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI) / 4;
    const at = (d) => [cx + Math.cos(angle) * d, cy + Math.sin(angle) * d].map((n) => n.toFixed(1));
    const [x1, y1] = at(r + 4);
    const [x2, y2] = at(r + 9);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join("");
  return (
    `<g class="spin" style="transform-origin:${cx}px ${cy}px" stroke="#fbbf24" stroke-width="3" stroke-linecap="round">${rays}</g>` +
    `<circle class="glow" cx="${cx}" cy="${cy}" r="${r}" fill="#fbbf24"/>`
  );
}

const moon = (transform = "") => `<path d="${MOON}" fill="#e0e7ff" transform="${transform}"/>`;
const star = (x, y, scale, delay) =>
  `<path class="twinkle" d="${STAR}" fill="#fff" transform="translate(${x} ${y}) scale(${scale})" style="animation-delay:${delay}s"/>`;

/** Slanted drops below the cloud; negative delays keep them mid-fall even when paused. */
function drops(xs, { length, color, delay }) {
  return xs
    .map(
      (x, i) =>
        `<line class="drop" x1="${x}" y1="50" x2="${x - 2}" y2="${50 + length}" stroke="${color}" stroke-width="3" stroke-linecap="round" style="animation-delay:${-(i * delay + 0.2).toFixed(2)}s"/>`,
    )
    .join("");
}

const flakes = (xs) =>
  xs
    .map((x, i) => `<circle class="flake" cx="${x}" cy="53" r="2.6" fill="#fff" style="animation-delay:${-(i * 0.8 + 0.4).toFixed(1)}s"/>`)
    .join("");

const mist = [
  [14, 50, 50],
  [20, 56, 56],
  [12, 62, 44],
]
  .map(
    ([x1, y, x2], i) =>
      `<line class="mist" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round" style="animation-delay:${-i * 0.9}s"/>`,
  )
  .join("");

function art(kind, isDay) {
  switch (kind) {
    case "clear":
      return isDay ? sun(32, 32, 12) : moon() + star(52, 16, 0.8, 0) + star(14, 46, 0.6, -1.2);
    case "partly":
      return `${isDay ? sun(24, 24, 9) : moon("translate(2 2) scale(.6)")}<g class="bob">${cloud(LIGHT, "translate(6 8)")}</g>`;
    case "cloudy":
      return `<g class="bob">${cloud(GREY, "translate(-7 -9)")}${cloud(LIGHT, "translate(4 4)")}</g>`;
    case "fog":
      return `<g class="bob">${cloud(GREY, "translate(0 -4)")}</g>${mist}`;
    case "drizzle":
      return `<g class="bob">${cloud(GREY)}</g>${drops([26, 35, 44], { length: 4, color: "#bae6fd", delay: 0.45 })}`;
    case "rain":
      return `<g class="bob">${cloud(GREY)}</g>${drops([22, 30, 38, 46], { length: 7, color: "#7dd3fc", delay: 0.3 })}`;
    case "snow":
      return `<g class="bob">${cloud(LIGHT)}</g>${flakes([24, 33, 42])}`;
    case "storm":
      return `<g class="bob">${cloud(DARK)}</g>${drops([22, 46], { length: 7, color: "#7dd3fc", delay: 0.5 })}<path class="bolt" d="${BOLT}" fill="#facc15"/>`;
    default:
      return cloud(GREY);
  }
}

/** An SVG string for a sky kind from `describe()`. Pass a label when the icon carries meaning on its own. */
export function icon(kind, isDay = true, label = "") {
  const a11y = label ? `role="img" aria-label="${label}"` : `aria-hidden="true"`;
  return `<svg class="wi wi-${kind}" viewBox="0 0 64 64" ${a11y}>${art(kind, isDay)}</svg>`;
}
