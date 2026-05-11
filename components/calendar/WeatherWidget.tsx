import type { CurrentWeather, ForecastDay } from "@/lib/api/weather";
import { Droplets, Wind } from "lucide-react";

type Props = {
  current: CurrentWeather | null;
  forecast: ForecastDay[] | null;
  locationDisplay: string | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function tempGradient(temp: number): string {
  if (temp <= 32) return "from-blue-100 via-blue-50 to-sky-50";
  if (temp <= 50) return "from-sky-50 via-[#F5F0E8] to-white";
  if (temp <= 65) return "from-[#F5F0E8] to-white";
  if (temp <= 80) return "from-amber-50 via-[#F5F0E8] to-white";
  return "from-orange-50 via-amber-50 to-[#F5F0E8]";
}

function tempColor(temp: number): string {
  if (temp <= 32) return "#4B9EBF";
  if (temp <= 50) return "#6B8FA8";
  if (temp <= 65) return "#6B6560";
  if (temp <= 80) return "#C4790A";
  return "#B85C3A";
}

export function WeatherWidget({ current, forecast, locationDisplay }: Props) {
  if (!current && !forecast) {
    return (
      <div className="bg-[#F5F0E8] rounded-xl border border-[#E8E2D9] p-4 text-center">
        <p className="text-sm text-[#9E9890]">Weather unavailable</p>
      </div>
    );
  }

  const mainColor = current ? tempColor(current.temp) : "#6B6560";

  return (
    <div className="rounded-2xl border border-[#E8E2D9] overflow-hidden shadow-sm">
      {/* Current conditions */}
      {current && (
        <div
          className={`bg-gradient-to-br ${tempGradient(current.temp)} px-5 pt-4 pb-3 border-b border-[#E8E2D9]`}
        >
          <div className="flex items-start justify-between">
            <div>
              {locationDisplay && (
                <p className="text-xs text-[#9E9890] mb-1 font-medium">{locationDisplay}</p>
              )}
              <div className="flex items-baseline gap-2">
                <span
                  className="font-display text-5xl font-bold leading-none"
                  style={{ color: mainColor }}
                >
                  {current.temp}°
                </span>
                <span className="text-sm text-[#6B6560] capitalize self-end pb-1">
                  {current.description}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-[#9E9890]">
                <span className="flex items-center gap-1">
                  <Droplets className="w-3 h-3" />
                  {current.humidity}%
                </span>
                <span className="flex items-center gap-1">
                  <Wind className="w-3 h-3" />
                  {current.windSpeed} mph
                </span>
                <span>Feels {current.feelsLike}°</span>
              </div>
            </div>
            {current.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://openweathermap.org/img/wn/${current.icon}@2x.png`}
                alt={current.description}
                width={72}
                height={72}
                className="-mt-1 -mr-1 drop-shadow-sm"
              />
            )}
          </div>
        </div>
      )}

      {/* 5-day forecast */}
      {forecast && forecast.length > 0 && (
        <div className="grid grid-cols-5 divide-x divide-[#E8E2D9] bg-white">
          {forecast.map((day) => {
            const d = new Date(day.date + "T12:00:00");
            const isFrost = day.minTemp <= 35;
            return (
              <div
                key={day.date}
                className={`flex flex-col items-center py-3 px-1 ${isFrost ? "bg-blue-50" : ""}`}
              >
                <span className="text-xs font-semibold text-[#6B6560]">
                  {DAYS[d.getDay()]}
                </span>
                {day.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                    alt={day.description}
                    width={36}
                    height={36}
                    className="my-0.5"
                  />
                )}
                <span className="text-sm font-bold text-[#1C1C1A]">{day.maxTemp}°</span>
                <span
                  className={`text-xs font-medium ${
                    isFrost ? "text-blue-600" : "text-[#9E9890]"
                  }`}
                >
                  {day.minTemp}°
                </span>
                {isFrost && (
                  <span className="text-[9px] text-blue-500 font-semibold mt-0.5">FROST</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
