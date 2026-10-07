// The animated sky behind the app. CSS draws the gradient, sun, moon, stars, clouds and fog from
// the `data-kind` and `data-time` attributes; a canvas adds rain and snow; storms flash.

const PRECIPITATION = {
  drizzle: { type: "rain", count: 70 },
  rain: { type: "rain", count: 170 },
  storm: { type: "rain", count: 240 },
  snow: { type: "snow", count: 150 },
};

const random = (min, max) => min + Math.random() * (max - min);

function addStars(layer, count = 90) {
  for (let i = 0; i < count; i++) {
    const star = document.createElement("i");
    star.style.cssText = `left:${random(0, 100)}%;top:${random(0, 100)}%;--size:${random(1, 2.6).toFixed(1)}px;animation-duration:${random(2, 5).toFixed(1)}s;animation-delay:${-random(0, 5).toFixed(1)}s`;
    layer.append(star);
  }
}

function addClouds(layer, count = 7) {
  for (let i = 0; i < count; i++) {
    const cloud = document.createElement("i");
    cloud.className = "cloud";
    const duration = random(70, 140);
    cloud.style.cssText = `--top:${random(2, 46).toFixed(1)}vh;--s:${random(0.6, 1.5).toFixed(2)};--d:${duration.toFixed(0)}s;--delay:${-random(0, duration).toFixed(0)}s;--x:${random(-10, 90).toFixed(0)}vw`;
    layer.append(cloud);
  }
}

export function createScene(sky) {
  const canvas = sky.querySelector("canvas");
  const context = canvas.getContext("2d");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let kind = null;
  let particles = [];
  let width = 0;
  let height = 0;
  let frame = 0;
  let last = 0;
  let flashTimer = 0;

  addStars(sky.querySelector(".stars"));
  addClouds(sky.querySelector(".clouds"));

  const settings = () => PRECIPITATION[kind];

  function particle(fromTop) {
    const depth = Math.random(); // 0 = far away, 1 = close to the glass
    if (settings().type === "rain") {
      return {
        depth,
        x: random(-height * 0.4, width),
        y: fromTop ? random(-80, -10) : random(0, height),
        speed: 9 + depth * 11,
        length: 10 + depth * 18,
      };
    }
    return {
      depth,
      x: random(0, width),
      y: fromTop ? random(-20, -5) : random(0, height),
      speed: 0.5 + depth * 1.4,
      size: 1.2 + depth * 3,
      phase: random(0, Math.PI * 2),
    };
  }

  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function draw(time) {
    const step = last ? Math.min((time - last) / 16.7, 3) : 1; // same speed at 60 Hz or 120 Hz
    last = time;
    context.clearRect(0, 0, width, height);

    if (settings().type === "rain") {
      const slant = kind === "storm" ? 0.32 : 0.14;
      context.lineCap = "round";
      for (const drop of particles) {
        drop.y += drop.speed * step;
        drop.x += drop.speed * slant * step;
        context.strokeStyle = `rgba(214, 230, 255, ${0.22 + drop.depth * 0.5})`;
        context.lineWidth = 0.8 + drop.depth * 1.3;
        context.beginPath();
        context.moveTo(drop.x, drop.y);
        context.lineTo(drop.x - drop.length * slant, drop.y - drop.length);
        context.stroke();
        if (drop.y - drop.length > height) Object.assign(drop, particle(true));
      }
    } else {
      context.fillStyle = "#ffffff";
      for (const flake of particles) {
        flake.y += flake.speed * step;
        flake.x += Math.sin(time / 1300 + flake.phase) * 0.45 * (0.4 + flake.depth) * step;
        context.globalAlpha = 0.35 + flake.depth * 0.6;
        context.beginPath();
        context.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
        context.fill();
        if (flake.y - flake.size > height) Object.assign(flake, particle(true));
      }
      context.globalAlpha = 1;
    }
    frame = requestAnimationFrame(draw);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  }

  function start() {
    stop();
    context.clearRect(0, 0, width, height);
    particles = [];
    if (!settings() || reduceMotion.matches || document.hidden) return;
    particles = Array.from({ length: settings().count }, () => particle(false));
    frame = requestAnimationFrame(draw);
  }

  function scheduleFlash() {
    clearTimeout(flashTimer);
    if (kind !== "storm" || reduceMotion.matches) return;
    flashTimer = setTimeout(() => {
      sky.classList.remove("flashing");
      void sky.offsetWidth; // restart the CSS animation
      sky.classList.add("flashing");
      scheduleFlash();
    }, random(3500, 9000));
  }

  resize();
  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      start();
    }, 150);
  });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  reduceMotion.addEventListener("change", () => {
    start();
    scheduleFlash();
  });

  return {
    /** Paint the sky for a kind from `describe()` and whether the sun is up. */
    set(nextKind, isDay) {
      sky.dataset.time = isDay ? "day" : "night";
      if (nextKind === kind) return;
      kind = nextKind;
      sky.dataset.kind = kind;
      start();
      scheduleFlash();
    },
  };
}
