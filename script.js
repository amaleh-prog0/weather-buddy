
const form = document.getElementById("weather-form");
const cityInput = document.getElementById("city");
const searchButton = document.getElementById("search-button");
const statusMessage = document.getElementById("status");
const weatherResult = document.getElementById("weather-result");
const forecastList = document.getElementById("forecast-list");

const celsiusButton = document.getElementById("celsius-button");
const fahrenheitButton = document.getElementById("fahrenheit-button");

// Application state: remember the last successful weather result.
let currentPlace = null;
let currentWeather = null;
let temperatureUnit = "C";

// Convert Celsius to Fahrenheit when needed.
function convertTemperature(celsius) {
  if (temperatureUnit === "F") {
    return (celsius * 9 / 5) + 32;
  }

  return celsius;
}

function formatTemperature(celsius) {
  return `${Math.round(convertTemperature(celsius))}°${temperatureUnit}`;
}

// Translate Open-Meteo weather codes into descriptions and icons.
function getWeatherDescription(code, isDay = true) {
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

// Find a city and obtain its coordinates.
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
    throw new Error("City search failed. Please try again.");
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error(
      "City not found. Check the spelling or add its country."
    );
  }

  return data.results[0];
}

// Fetch current conditions and a five-day forecast.
async function getWeather(latitude, longitude) {
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
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "sunrise",
      "sunset"
    ].join(","),
    forecast_days: "5",
    timezone: "auto"
  });

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params}`
  );

  if (!response.ok) {
    throw new Error("Weather request failed. Please try again.");
  }

  const data = await response.json();

  if (!data.current || !data.daily) {
    throw new Error("Weather data is unavailable for this location.");
  }

  return data;
}

function getWeatherRecommendation(weather) {
  const temperature = weather.current.temperature_2m;
  const rainChance =
    weather.daily.precipitation_probability_max?.[0] ?? 0;

  const recommendations = [];

  if (rainChance >= 60) {
    recommendations.push(
      "Carry an umbrella because rain is likely."
    );
  } else {
    recommendations.push(
      "The chance of rain is relatively low."
    );
  }

  if (temperature >= 30) {
    recommendations.push(
      "Stay hydrated and limit strenuous activity in the heat."
    );
  } else if (temperature <= 15) {
    recommendations.push(
      "Consider wearing a warm layer."
    );
  } else {
    recommendations.push(
      "Temperatures look comfortable for many outdoor activities."
    );
  }

  return recommendations;
}


function displayRecommendations(weather) {
  const list = document.getElementById("recommendation-list");
  const intro = document.getElementById("recommendation-intro");

  const recommendations = getWeatherRecommendation(weather);

  list.replaceChildren();

  recommendations.forEach((recommendation) => {
    const item = document.createElement("li");
    item.textContent = recommendation;
    list.appendChild(item);
  });

  intro.textContent = "Here's what the weather means for your day.";
}

// Display the current weather.
function displayCurrentWeather(place, weather) {
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

  document.getElementById("location-name").textContent =
    [...new Set(locationParts)].join(", ");

  document.getElementById("weather-icon").textContent =
    description.icon;

  document.getElementById("weather-icon").setAttribute(
    "aria-label",
    description.text
  );

  document.getElementById("temperature").textContent =
    formatTemperature(current.temperature_2m);

  document.getElementById("condition").textContent =
    description.text;

  document.getElementById("feels-like").textContent =
    `Feels like ${formatTemperature(current.apparent_temperature)}`;

  document.getElementById("humidity").textContent =
    `${current.relative_humidity_2m}%`;

  document.getElementById("wind").textContent =
    `${Math.round(current.wind_speed_10m)} km/h`;

  document.getElementById("local-time").textContent =
    `Local time: ${current.time.replace("T", " ")}`;

  weatherResult.hidden = false;
}

function formatTime(dateTime) {
  if (!dateTime) return "Unavailable";

  const date = new Date(dateTime);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

// Display the forecast array using a loop.
function displayForecast(weather) {
  const daily = weather.daily;

  forecastList.replaceChildren();

  daily.time.forEach((date, index) => {
    const description = getWeatherDescription(
      daily.weather_code[index]
    );

    // Noon avoids date shifts caused by local timezone conversion.
    const dateObject = new Date(`${date}T12:00:00`);

    const dayName = index === 0
      ? "Today"
      : dateObject.toLocaleDateString("en", {
          weekday: "short"
        });

    const dateLabel = dateObject.toLocaleDateString("en", {
      day: "numeric",
      month: "short"
    });

    const day = document.createElement("article");
    day.className = "forecast-day";

    const info = document.createElement("div");

    const dayLabel = document.createElement("div");
    dayLabel.className = "forecast-date";
    dayLabel.textContent = `${dayName} · ${dateLabel}`;

    const condition = document.createElement("div");
    condition.className = "forecast-condition";
    condition.textContent = description.text;

    info.append(dayLabel, condition);

    const icon = document.createElement("span");
    icon.className = "forecast-icon";
    icon.textContent = description.icon;
    icon.setAttribute("aria-hidden", "true");

    const temperatures = document.createElement("div");
    temperatures.className = "forecast-temperatures";

    const high = document.createElement("span");
    high.textContent = formatTemperature(
      daily.temperature_2m_max[index]
    );

    const low = document.createElement("span");
    low.className = "forecast-low";
    low.textContent = formatTemperature(
      daily.temperature_2m_min[index]
    );

    const rainChance = daily.precipitation_probability_max?.[index];
    const sunrise = daily.sunrise?.[index];
    const sunset = daily.sunset?.[index];

    const details = document.createElement("div");
    details.className = "forecast-details";
    details.textContent =
      `Rain: ${rainChance ?? "N/A"}% | ` +
      `Sunrise: ${formatTime(sunrise)} | ` +
      `Sunset: ${formatTime(sunset)}`;

    temperatures.append(high, low);
    day.append(info, icon, temperatures, details);
    forecastList.append(day);
  });
}

// Refresh both sections when the temperature unit changes.
function updateTemperatureUnit(unit) {
  temperatureUnit = unit;

  celsiusButton.classList.toggle("active", unit === "C");
  fahrenheitButton.classList.toggle("active", unit === "F");

  celsiusButton.setAttribute("aria-pressed", String(unit === "C"));
  fahrenheitButton.setAttribute("aria-pressed", String(unit === "F"));

  if (currentPlace && currentWeather) {
    displayCurrentWeather(currentPlace, currentWeather);
    displayForecast(currentWeather);
  }
}

celsiusButton.addEventListener("click", () => {
  updateTemperatureUnit("C");
});

fahrenheitButton.addEventListener("click", () => {
  updateTemperatureUnit("F");
});

// Search for a city and update the app.
form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const cityName = cityInput.value.trim();

  if (!cityName) {
    statusMessage.textContent = "Please enter a city name.";
    statusMessage.className = "status error";
    return;
  }

  searchButton.disabled = true;
  searchButton.textContent = "Loading...";
  statusMessage.className = "status";
  statusMessage.textContent = `Loading weather for ${cityName}...`;

  try {
    const place = await findCity(cityName);
    const weather = await getWeather(
      place.latitude,
      place.longitude
    );

    // Save the latest successful response.
    currentPlace = place;
    currentWeather = weather;

    displayCurrentWeather(place, weather);
    displayForecast(weather);
    displayRecommendations(weather);

    statusMessage.textContent =
      "Weather and forecast updated successfully.";
  } catch (error) {
    statusMessage.textContent =
      error.message || "Something went wrong. Please try again.";

    statusMessage.className = "status error";
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = "Search";
  }
});

// Load the default city when the page opens.
form.requestSubmit();
