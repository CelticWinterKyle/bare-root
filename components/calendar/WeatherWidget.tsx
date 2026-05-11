import type { CurrentWeather, ForecastDay } from "@/lib/api/weather";
import { Droplets, Wind } from "lucide-react";

type Props = {
  current: CurrentWeather | null;
  forecast: ForecastDay[] | null;
  locationDisplay: string | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeatherWidget({ current, forecast, locationDisplay }: Props) {
  if (!current && !forecast) {
    return (
      <div className="bg-[#F5F0E8] rounded-xl border border-[#E8E2D9] p-4 text-center">
        <p className="text-sm text-[#9E9890]">Weather unavailable</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E8E2D9] overflow-hidden">
      {/* Current conditions */}
      {current && (
        <div className="p-4 border-b border-[#E8E2D9]">
          <div className="flex items-start justify-between">
            <div>
              {locationDisplay && (
                <p className="text-xs text-[#9E9890] mb-1">{locationDisplay}</p>
              )}
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-semibold text-[#1C1C1A]">
                  {current.temp}°
                </span>
                <span className="text-sm text-[#6B6560] capitalize">{current.description}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-[#9E9890]">
                <span className="flex items-center gap-1">
                  <Droplets className="w-3 h-3" />
                  {current.humidity}%
                </span>
                <span className="flex items-center gap-1">
                  <Wind className="w-3 h-3" />
                  {current.windSpeed} mph
                </span>
                <span>Feels like {current.feelsLike}°</span>
              </div>
            </div>
            {current.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://openweathermap.org/img/wn/${current.icon}@2x.png`}
                alt={current.description}
                width={60}
                height={60}
                className="mt-1"
              />
            )}
          </div>
        </div>
      )}

      {/* 5-day forecast */}
      {forecast && forecast.length > 0 && (
        <div className="grid grid-cols-5 divide-x divide-[#E8E2D9]">
          {forecast.map((day) => {
            const d = new Date(day.date + "T12:00:00");
            const isFrost = day.minTemp <= 35;
            return (
              <div
                key={day.date}
                className={`flex flex-col items-center py-3 px-1 ${isFrost ? "bg-blue-50" : ""}`}
              >
                <span className="text-xs font-medium text-[#6B6560]">
                  {DAYS[d.getDay()]}
                </span>
                {day.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                    alt={day.description}
                    width={32}
                    height={32}
                  />
                )}
                <span className="text-xs font-semibold text-[#1C1C1A]">{day.maxTemp}°</span>
                <span className={`text-xs ${isFrost ? "text-blue-600 font-medium" : "text-[#9E9890]"}`}>
                  {day.minTemp}°
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
