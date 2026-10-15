import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.GROQ_API_KEY) {
  throw new Error("Missing GROQ_API_KEY in your .env file.");
}

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

app.use(cors());
app.use(express.json({ limit: "20kb" }));

// Test whether the backend is running.
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Weather Buddy AI backend is running.",
  });
});

// Answer a question using the supplied weather data.
app.post("/api/chat", async (req, res) => {
  try {
    const { question, weather } = req.body;

    if (
      typeof question !== "string" ||
      question.trim().length === 0 ||
      question.length > 1000
    ) {
      return res.status(400).json({
        error: "Enter a question of up to 1000 characters.",
      });
    }

    if (!weather || typeof weather !== "object" || Array.isArray(weather)) {
      return res.status(400).json({
        error: "Valid weather data is required.",
      });
    }

    const response = await groq.responses.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      instructions: `
        You are Weather Buddy, a friendly weather assistant.

        Answer questions using the weather data provided by the user.
        Do not invent weather conditions, forecasts, or measurements.
        If the data does not contain the information needed, say so.
        For soil-moisture, ground-wetness, or irrigation questions, use only
        directly provided soil measurements. Rain probability is not a soil
        measurement; never infer current or future soil wetness from it.
        If no soil measurement is provided, say that the data does not include
        soil-moisture measurements. Do not add speculative or unrelated advice.
        Give practical advice in 1-3 concise sentences.
        Use plain text only; do not use Markdown, headings, bold text, or lists.
        For potentially dangerous weather, recommend checking
        official local weather alerts.
      `,
      input: `
        Weather data:
        ${JSON.stringify(weather)}

        User question:
        ${question.trim()}
      `,
      max_output_tokens: 300,
    });

    res.json({
      answer: response.output_text,
    });
  } catch (error) {
    console.error("Weather Buddy AI error:", error.message);

    res.status(500).json({
      error: "The AI assistant could not answer right now. Please try again.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Weather Buddy backend running at http://localhost:${PORT}`);
});

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");
const chatStatus = document.getElementById("chat-status");
const chatSendButton = document.getElementById("chat-send");

function addChatMessage(message, sender) {
  const bubble = document.createElement("div");

  bubble.className =
    sender === "user"
      ? "chat-message user-message"
      : "chat-message assistant-message";

  // Use textContent to display text safely.
  bubble.textContent = message;

  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  return bubble;
}

function buildWeatherContext() {
  if (!currentPlace || !currentWeather) {
    throw new Error("Search for a city and load its weather first.");
  }

  const current = currentWeather.current;
  const daily = currentWeather.daily;

  return {
    location: [currentPlace.name, currentPlace.admin1, currentPlace.country]
      .filter(Boolean)
      .join(", "),

    current: {
      temperature_celsius: current.temperature_2m,
      humidity_percent: current.relative_humidity_2m,
      wind_speed_kmh: current.wind_speed_10m,
      weather_code: current.weather_code,
      is_day: current.is_day,
    },

    forecast: daily.time.map((date, index) => ({
      date,
      weather_code: daily.weather_code[index],
      maximum_temperature_celsius: daily.temperature_2m_max[index],
      minimum_temperature_celsius: daily.temperature_2m_min[index],
      rain_probability_percent:
        daily.precipitation_probability_max?.[index] ?? null,
      sunrise: daily.sunrise?.[index] ?? null,
      sunset: daily.sunset?.[index] ?? null,
    })),
  };
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const question = chatInput.value.trim();

  if (!question) return;

  let weather;

  try {
    weather = buildWeatherContext();
  } catch (error) {
    chatStatus.textContent = error.message;
    return;
  }

  addChatMessage(question, "user");
  chatInput.value = "";
  chatInput.disabled = true;
  chatSendButton.disabled = true;
  chatStatus.textContent = "Weather Buddy is thinking...";

  const loadingBubble = addChatMessage(
    "Checking your weather data...",
    "assistant",
  );

  try {
    const response = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        weather,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "The assistant could not answer.");
    }

    loadingBubble.textContent = data.answer;
    chatStatus.textContent = "";
  } catch (error) {
    loadingBubble.textContent =
      "Sorry, I couldn't get an answer. " +
      "Check that your backend is running and try again.";

    chatStatus.textContent = error.message;
  } finally {
    chatInput.disabled = false;
    chatSendButton.disabled = false;
    chatInput.focus();
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});
