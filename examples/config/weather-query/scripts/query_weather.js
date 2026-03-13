// ==CATTool==
// @name         query_weather
// @description  Query current weather for a city using OpenWeatherMap API
// @param        city string The city name to query weather for
// @grant        GM_xmlhttpRequest
// ==/CATTool==

const apiKey = CAT_CONFIG.API_KEY;
if (!apiKey) {
  return { error: "API_KEY not configured. Please set it in Skills → Config." };
}

const city = args.city || CAT_CONFIG.DEFAULT_CITY || "Beijing";
const units = CAT_CONFIG.UNITS || "metric";
const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${units}&appid=${apiKey}`;

const unitLabel = units === "metric" ? "°C" : units === "imperial" ? "°F" : "K";

const response = await new Promise((resolve, reject) => {
  GM_xmlhttpRequest({
    method: "GET",
    url,
    onload: (res) => resolve(res),
    onerror: (err) => reject(new Error("Request failed: " + (err.statusText || "network error"))),
    ontimeout: () => reject(new Error("Request timed out")),
  });
});

if (response.status !== 200) {
  let errorMsg = `HTTP ${response.status}`;
  try {
    const errData = JSON.parse(response.responseText);
    errorMsg += `: ${errData.message || response.responseText}`;
  } catch {
    errorMsg += `: ${response.responseText}`;
  }
  return { error: errorMsg };
}

const data = JSON.parse(response.responseText);

return {
  city: data.name,
  country: data.sys?.country,
  temperature: `${data.main.temp}${unitLabel}`,
  feelsLike: `${data.main.feels_like}${unitLabel}`,
  description: data.weather?.[0]?.description,
  humidity: `${data.main.humidity}%`,
  wind: `${data.wind?.speed} m/s`,
};
