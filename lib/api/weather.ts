const BASE = "https://api.openweathermap.org/data/2.5";

export type CurrentWeather = {
  temp: number;
  feelsLike: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
};

export type ForecastDay = {
  date: string; // YYYY-MM-DD
  minTemp: number;
  maxTemp: number;
  description: string;
  icon: string;
};

function apiKey(): string | null {
  return process.env.OPENWEATHER_API_KEY ?? null;
}

export async function fetchCurrentWeather(zip: string): Promise<CurrentWeather | null> {
  const key = apiKey();
  if (!key) return null;
  try {
    const res = await fetch(
      `${BASE}/weather?zip=${encodeURIComponent(zip)},US&appid=${key}&units=imperial`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      description: data.weather[0]?.description ?? "",
      icon: data.weather[0]?.icon ?? "",
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind?.speed ?? 0),
    };
  } catch {
    return null;
  }
}

export async function fetchForecast(zip: string): Promise<ForecastDay[] | null> {
  const key = apiKey();
  if (!key) return null;
  try {
    const res = await fetch(
      `${BASE}/forecast?zip=${encodeURIComponent(zip)},US&appid=${key}&units=imperial`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    // Group 3-hour intervals by day, compute min/max
    const byDay: Record<string, { mins: number[]; maxs: number[]; description: string; icon: string }> = {};
    for (const item of data.list) {
      const date = item.dt_txt.split(" ")[0];
      if (!byDay[date]) byDay[date] = { mins: [], maxs: [], description: "", icon: "" };
      byDay[date].mins.push(item.main.temp_min);
      byDay[date].maxs.push(item.main.temp_max);
      // Use noon reading for description/icon if available
      if (item.dt_txt.includes("12:00")) {
        byDay[date].description = item.weather[0]?.description ?? "";
        byDay[date].icon = item.weather[0]?.icon ?? "";
      } else if (!byDay[date].description) {
        byDay[date].description = item.weather[0]?.description ?? "";
        byDay[date].icon = item.weather[0]?.icon ?? "";
      }
    }

    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 5)
      .map(([date, v]) => ({
        date,
        minTemp: Math.round(Math.min(...v.mins)),
        maxTemp: Math.round(Math.max(...v.maxs)),
        description: v.description,
        icon: v.icon,
      }));
  } catch {
    return null;
  }
}

export function hasFrostRisk(forecast: ForecastDay[]): boolean {
  return forecast.some((d) => d.minTemp <= 35);
}
