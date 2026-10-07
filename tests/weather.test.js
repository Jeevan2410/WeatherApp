import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clock,
  dayName,
  daylight,
  describe,
  nextHours,
  placeLabel,
  rangeBar,
  temp,
  toFahrenheit,
  wind,
} from "../src/weather.js";

test("describe maps WMO codes to a label and a sky kind", () => {
  assert.deepEqual(describe(0), { label: "Clear sky", kind: "clear" });
  assert.deepEqual(describe(2), { label: "Partly cloudy", kind: "partly" });
  assert.deepEqual(describe(48), { label: "Fog", kind: "fog" });
  assert.deepEqual(describe(63), { label: "Rain", kind: "rain" });
  assert.deepEqual(describe(82), { label: "Violent showers", kind: "rain" });
  assert.deepEqual(describe(86), { label: "Snow showers", kind: "snow" });
  assert.deepEqual(describe(99), { label: "Thunderstorm with hail", kind: "storm" });
});

test("describe falls back for an unknown code", () => {
  assert.deepEqual(describe(42), { label: "Unknown", kind: "cloudy" });
});

test("temperatures convert and round, without negative zero", () => {
  assert.equal(toFahrenheit(100), 212);
  assert.equal(temp(21.6, "C"), 22);
  assert.equal(temp(21.6, "F"), 71);
  assert.equal(Object.is(temp(-0.4, "C"), -0), false);
});

test("wind follows the temperature unit", () => {
  assert.equal(wind(5, "C"), "18 km/h");
  assert.equal(wind(5, "F"), "11 mph");
});

test("daylight is the share of the day between sunrise and sunset", () => {
  assert.equal(daylight("2026-10-07T12:00", "2026-10-07T06:00", "2026-10-07T18:00"), 0.5);
  assert.equal(daylight("2026-10-07T04:30", "2026-10-07T06:00", "2026-10-07T18:00"), 0);
  assert.equal(daylight("2026-10-07T21:15", "2026-10-07T06:00", "2026-10-07T18:00"), 1);
  // Polar night: Open-Meteo reports the same instant for both.
  assert.equal(daylight("2026-12-21T12:00", "2026-12-21T00:00", "2026-12-21T00:00"), null);
});

test("clock reads the place's local time from the ISO string", () => {
  assert.equal(clock("2026-10-07T06:12"), "06:12");
});

test("dayName says Today first, then short weekdays", () => {
  assert.equal(dayName("2026-10-07", 0), "Today");
  assert.equal(dayName("2026-10-08", 1), "Thu");
});

test("rangeBar places a day inside the week's range", () => {
  assert.deepEqual(rangeBar(20, 30, 10, 30), { left: 50, width: 50 });
  // A day with min == max still gets a visible sliver, kept inside the track.
  const flat = rangeBar(30, 30, 10, 30);
  assert.equal(flat.width, 4);
  assert.equal(flat.left + flat.width <= 100, true);
});

test("placeLabel joins name, region and country without repeats", () => {
  assert.equal(placeLabel({ name: "Mangaluru", admin1: "Karnataka", country: "India" }), "Mangaluru, Karnataka, India");
  assert.equal(placeLabel({ name: "Singapore", admin1: "Singapore", country: "Singapore" }), "Singapore");
});

test("nextHours starts at the current hour", () => {
  const hourly = {
    time: ["2026-10-07T08:00", "2026-10-07T09:00", "2026-10-07T10:00", "2026-10-07T11:00"],
    temperature_2m: [20, 21, 22, 23],
    weather_code: [0, 1, 2, 3],
    is_day: [1, 1, 1, 1],
    precipitation_probability: [0, 5, 10, 20],
  };
  const hours = nextHours(hourly, "2026-10-07T09:40", 2);
  assert.deepEqual(hours, [
    { time: "2026-10-07T09:00", temperature: 21, code: 1, isDay: true, rain: 5 },
    { time: "2026-10-07T10:00", temperature: 22, code: 2, isDay: true, rain: 10 },
  ]);
});
