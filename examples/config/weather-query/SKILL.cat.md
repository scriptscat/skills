---
name: weather-query
description: Query weather information via OpenWeatherMap API
config:
  API_KEY:
    title: "OpenWeatherMap API Key"
    type: text
    secret: true
    required: true
  DEFAULT_CITY:
    title: "Default City"
    type: text
    default: "Beijing"
  UNITS:
    title: "Temperature Units"
    type: select
    values:
      - metric
      - imperial
      - standard
    default: metric
---

# Weather Query Skill

You can query current weather information for any city using the `query_weather` tool.

## Usage

- When the user asks about weather, call `query_weather` with the city name.
- If no city is specified, use the default city from config.
- Temperature units are configurable (metric=°C, imperial=°F, standard=K).

## Response Format

Return the weather information in a readable format including:
- Temperature and "feels like" temperature
- Weather description
- Humidity and wind speed
