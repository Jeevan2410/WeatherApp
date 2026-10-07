// Network calls. Open-Meteo needs no API key, so nothing secret ships to the browser.

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";
// Free client-side reverse geocoding, meant for the visitor's own device location.
const REVERSE = "https://api.bigdatacloud.net/data/reverse-geocode-client";

async function getJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}`);
  return response.json();
}

/** Coordinates are rounded to about 100 m: plenty for weather, kinder to privacy. */
export function forecastUrl(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(3),
    longitude: longitude.toFixed(3),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,surface_pressure",
    hourly: "temperature_2m,weather_code,precipitation_probability,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "7",
    wind_speed_unit: "ms",
  });
  return `${FORECAST}?${params}`;
}

export function forecast({ latitude, longitude }, signal) {
  return getJson(forecastUrl(latitude, longitude), signal);
}

/** Up to six places matching `query`, trimmed to what the app uses. */
export async function searchPlaces(query, signal) {
  const params = new URLSearchParams({ name: query, count: "6", language: "en", format: "json" });
  // The API leaves `results` out entirely when nothing matches.
  const { results = [] } = await getJson(`${GEOCODING}?${params}`, signal);
  return results.map(({ name, admin1, country, latitude, longitude }) => ({ name, admin1, country, latitude, longitude }));
}

/** A readable name for the visitor's coordinates; falls back to "My location" if the lookup fails. */
export async function reversePlace(latitude, longitude, signal) {
  try {
    const params = new URLSearchParams({
      latitude: latitude.toFixed(3),
      longitude: longitude.toFixed(3),
      localityLanguage: "en",
    });
    const data = await getJson(`${REVERSE}?${params}`, signal);
    const name = data.city || data.locality;
    if (name) return { name, admin1: data.principalSubdivision, country: data.countryName };
  } catch (error) {
    if (error.name === "AbortError") throw error;
  }
  return { name: "My location" };
}
