import { test } from "node:test";
import assert from "node:assert/strict";
import { forecastUrl, reversePlace, searchPlaces } from "../src/api.js";

const reply = (body, ok = true) => async () => ({ ok, status: ok ? 200 : 500, json: async () => body });

test("forecastUrl asks for local time and every field the app shows", () => {
  const url = new URL(forecastUrl(12.91415, 74.856));
  assert.equal(`${url.origin}${url.pathname}`, "https://api.open-meteo.com/v1/forecast");
  assert.equal(url.searchParams.get("latitude"), "12.914");
  assert.equal(url.searchParams.get("timezone"), "auto");
  assert.equal(url.searchParams.get("wind_speed_unit"), "ms");
  for (const field of ["temperature_2m", "apparent_temperature", "is_day", "weather_code", "surface_pressure"]) {
    assert.ok(url.searchParams.get("current").split(",").includes(field), field);
  }
  assert.ok(url.searchParams.get("hourly").split(",").includes("is_day"));
  assert.ok(url.searchParams.get("daily").split(",").includes("sunrise"));
});

test("searchPlaces keeps only what the app needs", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    reply({
      results: [
        { id: 2988507, name: "Paris", admin1: "Île-de-France", country: "France", latitude: 48.85, longitude: 2.35, population: 2138551 },
      ],
    }),
  );
  assert.deepEqual(await searchPlaces("Paris"), [
    { name: "Paris", admin1: "Île-de-France", country: "France", latitude: 48.85, longitude: 2.35 },
  ]);
  const requested = new URL(globalThis.fetch.mock.calls[0].arguments[0]);
  assert.equal(requested.searchParams.get("name"), "Paris");
});

test("searchPlaces returns an empty list when nothing matches", async (t) => {
  t.mock.method(globalThis, "fetch", reply({ generationtime_ms: 0.4 }));
  assert.deepEqual(await searchPlaces("Qwxyzzz"), []);
});

test("searchPlaces surfaces HTTP errors", async (t) => {
  t.mock.method(globalThis, "fetch", reply({}, false));
  await assert.rejects(searchPlaces("Paris"), /answered 500/);
});

test("reversePlace names the visitor's city", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    reply({ city: "", locality: "Mangaluru", principalSubdivision: "Karnataka", countryName: "India" }),
  );
  assert.deepEqual(await reversePlace(12.91, 74.86), { name: "Mangaluru", admin1: "Karnataka", country: "India" });
});

test("reversePlace falls back when the lookup fails", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Failed to fetch");
  });
  assert.deepEqual(await reversePlace(0, 0), { name: "My location" });
});
