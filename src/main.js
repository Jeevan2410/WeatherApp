import { forecast, reversePlace, searchPlaces } from "./api.js";
import { icon } from "./icons.js";
import { createScene } from "./scene.js";
import { clock, dayName, daylight, describe, nextHours, placeLabel, rangeBar, temp, wind } from "./weather.js";

const FALLBACK = { name: "London", admin1: "England", country: "United Kingdom", latitude: 51.5085, longitude: -0.1257 };
const REFRESH_MS = 15 * 60 * 1000;

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const scene = createScene($("sky"));

// Preview any sky regardless of the real weather: ?sky=storm&time=night
const preview = new URLSearchParams(location.search);
const SKIES = ["clear", "partly", "cloudy", "fog", "drizzle", "rain", "snow", "storm"];
const previewSky = SKIES.includes(preview.get("sky")) ? preview.get("sky") : null;
const previewTime = ["day", "night"].includes(preview.get("time")) ? preview.get("time") : null;

const store = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(`weather:${key}`));
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`weather:${key}`, JSON.stringify(value));
    } catch {
      // Storage can be blocked (private mode, site data off); the app works without it.
    }
  },
};

const state = { place: null, data: null, loadedAt: 0, unit: store.get("unit") === "F" ? "F" : "C" };
let pending = null;

/* ---------- motion helpers ---------- */

const frames = new Map();

/** Ease `from` → `to` over `duration` ms, calling `onFrame` each frame. One tween per key at a time. */
function tween(key, from, to, duration, onFrame) {
  cancelAnimationFrame(frames.get(key));
  if (reduceMotion.matches || from === to) return onFrame(to);
  const start = performance.now();
  const step = (now) => {
    const t = Math.min((now - start) / duration, 1);
    onFrame(from + (to - from) * (1 - (1 - t) ** 3));
    if (t < 1) frames.set(key, requestAnimationFrame(step));
  };
  frames.set(key, requestAnimationFrame(step));
}

function withTransition(update) {
  if (!document.startViewTransition || reduceMotion.matches) return update();
  document.startViewTransition(update);
}

/* ---------- loading ---------- */

async function load(place, { remember = true, animate = true } = {}) {
  pending?.abort();
  const controller = new AbortController();
  pending = controller;
  try {
    const data = await forecast(place, controller.signal);
    Object.assign(state, { place, data, loadedAt: Date.now() });
    if (remember) store.set("place", place);
    if (animate) withTransition(render);
    else render();
  } catch (error) {
    if (error.name === "AbortError") return;
    toast(state.data ? "Couldn't refresh the weather. Check your connection." : "Couldn't load the weather. Check your connection and try again.");
  } finally {
    if (pending === controller) {
      pending = null;
      document.body.classList.remove("loading");
    }
  }
}

function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation is not supported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000, maximumAge: 10 * 60 * 1000 });
  });
}

async function useMyLocation({ firstVisit = false } = {}) {
  const button = $("locate");
  button.classList.add("busy");
  button.disabled = true;
  try {
    const { coords } = await currentPosition();
    const latitude = Number(coords.latitude.toFixed(3));
    const longitude = Number(coords.longitude.toFixed(3));
    const place = await reversePlace(latitude, longitude);
    await load({ ...place, latitude, longitude });
  } catch (error) {
    if (firstVisit) toast(`Showing ${FALLBACK.name}. Search for your city or allow location access.`, "info");
    else if (error.code === 1) toast("Location access is blocked for this site. Search for a city instead.");
    else toast("Couldn't find your location. Search for a city instead.");
  } finally {
    button.classList.remove("busy");
    button.disabled = false;
  }
}

/* ---------- rendering ---------- */

let shownTemp = null;
let sunAt = 0;

function render() {
  const { place, data, unit } = state;
  const { current, daily } = data;
  const now = describe(current.weather_code);
  const isDay = current.is_day === 1;
  const degrees = temp(current.temperature_2m, unit);
  const localDate = new Date(`${current.time}:00`).toLocaleDateString("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  scene.set(previewSky ?? now.kind, previewTime ? previewTime === "day" : isDay);
  document.title = `${degrees}° ${place.name} · Weather`;
  $("place").textContent = placeLabel(place);
  $("date").textContent = `${localDate} · ${clock(current.time)} local time`;
  $("now-icon").innerHTML = icon(now.kind, isDay);
  tween("temp", shownTemp ?? 0, degrees, 900, (value) => {
    shownTemp = value;
    $("temp").textContent = Math.round(value);
  });
  $("unit-sign").textContent = `°${unit}`;
  $("label").textContent = now.label;
  $("range").textContent = `H ${temp(daily.temperature_2m_max[0], unit)}°  ·  L ${temp(daily.temperature_2m_min[0], unit)}°`;
  $("feels").textContent = `${temp(current.apparent_temperature, unit)}°`;
  $("humidity").textContent = `${current.relative_humidity_2m}%`;
  $("wind").textContent = wind(current.wind_speed_10m, unit);
  $("pressure").textContent = `${Math.round(current.surface_pressure)} hPa`;
  $("sunrise").textContent = clock(daily.sunrise[0]);
  $("sunset").textContent = clock(daily.sunset[0]);
  moveSun(daylight(current.time, daily.sunrise[0], daily.sunset[0]) ?? (isDay ? 0.5 : 0), isDay);
  renderHours();
  renderDays();
  $("announce").textContent = `${placeLabel(place)}: ${degrees} degrees ${unit === "F" ? "Fahrenheit" : "Celsius"}, ${now.label}.`;
}

function moveSun(fraction, isDay) {
  const sun = $("arc-sun");
  sun.classList.toggle("down", !isDay);
  tween("sun", sunAt, fraction, 1400, (f) => {
    sunAt = f;
    sun.setAttribute("cx", (100 - 90 * Math.cos(Math.PI * f)).toFixed(2));
    sun.setAttribute("cy", (100 - 90 * Math.sin(Math.PI * f)).toFixed(2));
    $("arc-done").style.strokeDashoffset = String(100 - f * 100);
  });
}

function renderHours() {
  const { data, unit } = state;
  const hours = nextHours(data.hourly, data.current.time, 24);
  $("hours").innerHTML = hours
    .map((hour, i) => {
      const { kind, label } = describe(hour.code);
      return `<li style="--i:${i}">
        <span class="h-time">${i === 0 ? "Now" : clock(hour.time)}</span>
        ${icon(kind, hour.isDay, label)}
        <span class="h-temp">${temp(hour.temperature, unit)}°</span>
        <span class="h-rain">${hour.rain >= 20 ? `${hour.rain}%` : ""}</span>
      </li>`;
    })
    .join("");
}

function renderDays() {
  const { data, unit } = state;
  const { daily } = data;
  const weekMin = Math.min(...daily.temperature_2m_min);
  const weekMax = Math.max(...daily.temperature_2m_max);
  $("days").innerHTML = daily.time
    .map((date, i) => {
      const { kind, label } = describe(daily.weather_code[i]);
      const min = daily.temperature_2m_min[i];
      const max = daily.temperature_2m_max[i];
      const rain = daily.precipitation_probability_max[i];
      const bar = rangeBar(min, max, weekMin, weekMax);
      // Stretch one cold-to-hot gradient across the whole week so each bar shows its slice of it.
      const size = 10000 / bar.width;
      const offset = bar.width >= 100 ? 0 : (100 * bar.left) / (100 - bar.width);
      return `<li style="--i:${i}">
        <span class="d-name">${dayName(date, i)}</span>
        ${icon(kind, true, label)}
        <span class="d-rain">${rain >= 20 ? `${rain}%` : ""}</span>
        <span class="d-min">${temp(min, unit)}°</span>
        <span class="d-bar"><i style="left:${bar.left.toFixed(2)}%;width:${bar.width.toFixed(2)}%;background-size:${size.toFixed(2)}% 100%;background-position:${offset.toFixed(2)}% 0"></i></span>
        <span class="d-max">${temp(max, unit)}°</span>
      </li>`;
    })
    .join("");
}

let toastTimer = 0;
function toast(message, tone = "error") {
  const box = $("toast");
  box.textContent = message;
  box.dataset.tone = tone;
  box.hidden = false;
  box.classList.remove("show");
  void box.offsetWidth; // replay the entrance when messages arrive back to back
  box.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.hidden = true), 4500);
}

/* ---------- units ---------- */

const units = $("units");
function paintUnits() {
  units.dataset.unit = state.unit;
  for (const button of units.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.unit === state.unit));
  }
}
units.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-unit]");
  if (!button || button.dataset.unit === state.unit) return;
  state.unit = button.dataset.unit;
  store.set("unit", state.unit);
  paintUnits();
  if (state.data) render();
});

/* ---------- search ---------- */

const input = $("q");
const list = $("suggestions");
let results = [];
let active = -1;
let searching = null;
let debounce = 0;

function closeList() {
  list.hidden = true;
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");
  active = -1;
}

function highlight(index) {
  active = index;
  for (const [i, option] of [...list.children].entries()) option.setAttribute("aria-selected", String(i === index));
  if (index >= 0) input.setAttribute("aria-activedescendant", `place-${index}`);
}

function showList() {
  list.replaceChildren(
    ...(results.length
      ? results.map((place, i) => {
          const option = document.createElement("li");
          option.id = `place-${i}`;
          option.setAttribute("role", "option");
          option.setAttribute("aria-selected", "false");
          const name = document.createElement("strong");
          name.textContent = place.name;
          const where = document.createElement("span");
          where.textContent = [place.admin1, place.country].filter(Boolean).join(", ");
          option.append(name, where);
          // pointerdown fires before the input loses focus, so the list is still there to click.
          option.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            choose(i);
          });
          return option;
        })
      : [Object.assign(document.createElement("li"), { className: "empty", textContent: "No matching places" })]),
  );
  list.hidden = false;
  input.setAttribute("aria-expanded", "true");
  active = -1;
}

async function suggest(query) {
  searching?.abort();
  const controller = new AbortController();
  searching = controller;
  try {
    results = await searchPlaces(query, controller.signal);
    if (document.activeElement === input) showList();
  } catch (error) {
    if (error.name !== "AbortError") closeList();
  }
}

function choose(index) {
  const place = results[index];
  if (!place) return;
  input.value = "";
  closeList();
  input.blur();
  load(place);
}

input.addEventListener("input", () => {
  clearTimeout(debounce);
  const query = input.value.trim();
  if (query.length < 2) {
    searching?.abort();
    results = [];
    return closeList();
  }
  debounce = setTimeout(() => suggest(query), 250);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Escape") return closeList();
  if (list.hidden || !results.length) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    highlight((active + step + results.length) % results.length);
  }
});

input.addEventListener("blur", closeList);

$("search").addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) return;
  if (active >= 0) return choose(active);
  // Enter pressed before the suggestions arrived, or with none highlighted: take the best match.
  clearTimeout(debounce);
  searching?.abort();
  try {
    results = await searchPlaces(query);
    if (results.length) choose(0);
    else toast(`No place called "${query}" was found.`);
  } catch {
    toast("Search failed. Check your connection and try again.");
  }
});

$("locate").addEventListener("click", () => useMyLocation());

/* ---------- start ---------- */

paintUnits();

const saved = store.get("place");
if (Number.isFinite(saved?.latitude) && Number.isFinite(saved?.longitude)) {
  load(saved, { animate: false });
} else {
  // Show something straight away; switch to the visitor's own place if they share it.
  load(FALLBACK, { remember: false, animate: false });
  useMyLocation({ firstVisit: true });
}

setInterval(() => {
  if (!document.hidden && state.place && !pending && Date.now() - state.loadedAt > REFRESH_MS) {
    load(state.place, { remember: false, animate: false });
  }
}, 60 * 1000);
