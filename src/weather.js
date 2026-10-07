// Pure helpers: no DOM, no network. Covered by tests/weather.test.js.

/** WMO weather interpretation codes, as returned by Open-Meteo, mapped to a label and a sky kind. */
const CODES = [
  [[0], "Clear sky", "clear"],
  [[1], "Mainly clear", "clear"],
  [[2], "Partly cloudy", "partly"],
  [[3], "Overcast", "cloudy"],
  [[45, 48], "Fog", "fog"],
  [[51], "Light drizzle", "drizzle"],
  [[53], "Drizzle", "drizzle"],
  [[55], "Dense drizzle", "drizzle"],
  [[56, 57], "Freezing drizzle", "drizzle"],
  [[61], "Light rain", "rain"],
  [[63], "Rain", "rain"],
  [[65], "Heavy rain", "rain"],
  [[66, 67], "Freezing rain", "rain"],
  [[71], "Light snow", "snow"],
  [[73], "Snow", "snow"],
  [[75], "Heavy snow", "snow"],
  [[77], "Snow grains", "snow"],
  [[80], "Light showers", "rain"],
  [[81], "Showers", "rain"],
  [[82], "Violent showers", "rain"],
  [[85, 86], "Snow showers", "snow"],
  [[95], "Thunderstorm", "storm"],
  [[96, 99], "Thunderstorm with hail", "storm"],
];

/** @returns {{ label: string, kind: "clear"|"partly"|"cloudy"|"fog"|"drizzle"|"rain"|"snow"|"storm" }} */
export function describe(code) {
  const found = CODES.find(([codes]) => codes.includes(code));
  return found ? { label: found[1], kind: found[2] } : { label: "Unknown", kind: "cloudy" };
}

export const toFahrenheit = (celsius) => (celsius * 9) / 5 + 32;

/** Rounded temperature in the chosen unit, without the unit sign. */
export function temp(celsius, unit) {
  const value = unit === "F" ? toFahrenheit(celsius) : celsius;
  return Math.round(value) === 0 ? 0 : Math.round(value); // never "-0"
}

/** Wind from m/s: km/h next to °C, mph next to °F. */
export function wind(metersPerSecond, unit) {
  return unit === "F" ? `${Math.round(metersPerSecond * 2.23694)} mph` : `${Math.round(metersPerSecond * 3.6)} km/h`;
}

const minutes = (iso) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));

/**
 * How far the day has got between sunrise (0) and sunset (1), clamped, for the sun arc.
 * Null when there is no ordinary sunrise and sunset, as in polar day or night.
 */
export function daylight(nowIso, sunriseIso, sunsetIso) {
  const rise = minutes(sunriseIso);
  const set = minutes(sunsetIso);
  if (!(set > rise)) return null;
  return Math.min(Math.max((minutes(nowIso) - rise) / (set - rise), 0), 1);
}

/**
 * "HH:MM" from Open-Meteo's local ISO time ("2026-10-07T06:12"). With `timezone=auto` the API
 * already answers in the place's own time, so reading the string avoids shifting it into the
 * viewer's time zone.
 */
export const clock = (iso) => iso.slice(11, 16);

/** "Today" for the first day, else a short weekday. Noon avoids date-line surprises. */
export function dayName(isoDate, index) {
  if (index === 0) return "Today";
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en", { weekday: "short" });
}

/** Position of one day's min..max inside the week's range, as percentages for a bar. */
export function rangeBar(min, max, weekMin, weekMax) {
  const span = weekMax - weekMin || 1;
  const left = ((min - weekMin) / span) * 100;
  const width = Math.max(((max - min) / span) * 100, 4);
  return { left: Math.max(0, Math.min(left, 100 - width)), width };
}

/** "Mangaluru, Karnataka, India" without repeating parts. */
export function placeLabel({ name, admin1, country }) {
  return [...new Set([name, admin1, country].filter(Boolean))].join(", ");
}

/** The next `count` hours starting at the current hour, from Open-Meteo's hourly arrays. */
export function nextHours(hourly, nowIso, count = 12) {
  const currentHour = `${nowIso.slice(0, 13)}:00`;
  let start = hourly.time.findIndex((t) => t >= currentHour);
  if (start === -1) start = 0;
  return hourly.time.slice(start, start + count).map((time, i) => ({
    time,
    temperature: hourly.temperature_2m[start + i],
    code: hourly.weather_code[start + i],
    isDay: hourly.is_day[start + i] === 1,
    rain: hourly.precipitation_probability?.[start + i] ?? null,
  }));
}
