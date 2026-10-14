
const form = document.getElementById("weather-form");
const cityInput = document.getElementById("city");
const searchButton = document.getElementById("search-button");
const statusMessage = document.getElementById("status");
const weatherResult = document.getElementById("weather-result");

// Convert weather codes into readable descriptions and icons.
function getWeatherDescription(code, isDay) {
  if (code === 0) {
    return { text: "Clear sky", icon: isDay ? "☀️" : "🌙" };
  }

  if (code === 1) {
    return { text: "Mainly clear", icon: isDay ? "🌤️" : "🌙" };
  }

  if (code === 2) {
    return { text: "Partly cloudy", icon: "⛅" };
  }

  if (code === 3) {
    return { text: "Overcast", icon: "☁️" };
  }

  if ([45, 48].includes(code)) {
    return { text: "Foggy", icon: "🌫️" };
  }

  if ([51, 53, 55, 56, 57].includes(code)) {
    return { text: "Drizzle", icon: "🌦️" };
  }

  if ([61, 63, 65, 66, 67].includes(code)) {
    return { text: "Rain", icon: "🌧️" };
  }

  if ([71, 73, 75, 77].includes(code)) {
    return { text: "Snow", icon: "❄️" };
  }

  if ([80, 81, 82].includes(code)) {
    return { text: "Rain showers", icon: "🌦️" };
  }

  if ([85, 86].includes(code)) {
    return { text: "Snow showers", icon: "🌨️" };
  }

  if (code === 95) {
    return { text: "Thunderstorm", icon: "⛈️" };
  }

  if ([96, 99].includes(code)) {
    return { text: "Thunderstorm with hail", icon: "⛈️" };
  }

  return { text: "Conditions unavailable", icon: "🌡️" };
}

// Find a city's coordinates using its name.
async function findCity(cityName) {
  const params = new URLSearchParams({
    name: cityName,
    count: "1",
    language: "en",
    format: "json"
  });

  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${params}`
  );

  if (!response.ok) {
    throw new Error("Could not search for the city. Try again.");
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error(
      "City not found. Check the spelling or try adding the country."
    );
  }

  return data.results[0];
}

// Request current weather for the city's coordinates.
async function getCurrentWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "weather_code",
      "wind_speed_10m"
    ].join(","),
    timezone: "auto"
  });

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params}`
  );

  if (!response.ok) {
    throw new Error("Could not retrieve weather data. Please try again.");
  }

  const data = await response.json();

  if (!data.current) {
    throw new Error("Weather data is unavailable for this location.");
  }

  return data;
}

// Display the retrieved weather on the page.
function displayWeather(place, weather) {
  const current = weather.current;
  const description = getWeatherDescription(
    current.weather_code,
    current.is_day === 1
  );

  const locationParts = [
    place.name,
    place.admin1,
    place.country
  ].filter(Boolean);

  // Avoid repeating identical location labels.
  const uniqueParts = [...new Set(locationParts)];

  document.getElementById("location-name").textContent =
    uniqueParts.join(", ");

  document.getElementById("weather-icon").textContent =
    description.icon;

  document.getElementById("weather-icon").setAttribute(
    "aria-label",
    description.text
  );

  document.getElementById("temperature").textContent =
    `${Math.round(current.temperature_2m)}°C`;

  document.getElementById("condition").textContent =
    description.text;

  document.getElementById("feels-like").textContent =
    `Feels like ${Math.round(current.apparent_temperature)}°C`;

  document.getElementById("humidity").textContent =
    `${current.relative_humidity_2m}%`;

  document.getElementById("wind").textContent =
    `${Math.round(current.wind_speed_10m)} km/h`;

  document.getElementById("local-time").textContent =
    weather.current.time
      ? `Local time: ${weather.current.time.replace("T", " ")}`
      : "";

  weatherResult.hidden = false;
}

// Handle the search form.
form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const cityName = cityInput.value.trim();

  if (!cityName) {
    statusMessage.textContent = "Please enter a city name.";
    statusMessage.className = "status error";
    return;
  }

  searchButton.disabled = true;
  searchButton.textContent = "Searching...";
  statusMessage.className = "status";
  statusMessage.textContent = `Finding weather for ${cityName}...`;
  weatherResult.hidden = true;

  try {
    const place = await findCity(cityName);

    const weather = await getCurrentWeather(
      place.latitude,
      place.longitude
    );

    displayWeather(place, weather);

    statusMessage.textContent =
      "Weather updated successfully.";
  } catch (error) {
    statusMessage.textContent =
      error.message || "Something went wrong. Please try again.";

    statusMessage.className = "status error";
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = "Search";
  }
});

// Load an initial weather report when the page opens.
form.requestSubmit();
