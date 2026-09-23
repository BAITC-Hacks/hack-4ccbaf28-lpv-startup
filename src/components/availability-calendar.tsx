"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import type { Brief } from "@/domain/brief";
import type { AvailabilityCalendar } from "@/domain/calendar";
import { CALENDAR_START, CALENDAR_END } from "@/domain/schema";
import { money } from "@/domain/matching";

export const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
const shortPrice = (n: number) =>
  n >= 1000000
    ? `${Number((n / 1000000).toFixed(2))}м`
    : `${Math.round(n / 1000)}к`;
const calendarCache = new Map<string, AvailabilityCalendar>();

export default function Calendar({
  brief,
  onSelect,
}: {
  brief: Brief;
  onSelect: (date: string) => void;
}) {
  const [month, setMonth] = useState(
    brief.date?.slice(0, 7) || CALENDAR_START.slice(0, 7),
  );
  const [data, setData] = useState<AvailabilityCalendar | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const signature = JSON.stringify({
    city: brief.city,
    category: brief.category,
    event_format: brief.event_format,
    budget_kzt: brief.budget_kzt,
    language: brief.language,
    hours: brief.hours,
  });
  useEffect(() => {
    const cached = calendarCache.get(signature);
    if (cached) {
      setData(cached);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError("");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: signature,
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (calendarCache.size >= 30)
          calendarCache.delete(calendarCache.keys().next().value!);
        calendarCache.set(signature, result);
        setData(result);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Цены пока недоступны");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [signature]);
  const first = new Date(`${month}-01T12:00:00Z`);
  const leading = (first.getUTCDay() + 6) % 7;
  const total = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  function move(offset: number) {
    const d = new Date(first);
    d.setUTCMonth(d.getUTCMonth() + offset);
    setMonth(d.toISOString().slice(0, 7));
  }
  return (
    <div className="calendar">
      <div className="calendar-heading">
        <button
          type="button"
          className="icon-button"
          aria-label="Предыдущий месяц"
          disabled={month <= CALENDAR_START.slice(0, 7)}
          onClick={() => move(-1)}
        >
          <ChevronLeft size={17} />
        </button>
        <strong>
          {first.toLocaleDateString("ru-RU", {
            month: "long",
            year: "numeric",
          })}
        </strong>
        <button
          type="button"
          className="icon-button"
          aria-label="Следующий месяц"
          disabled={month >= CALENDAR_END.slice(0, 7)}
          onClick={() => move(1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
      <div
        className="calendar-grid"
        role="group"
        aria-label="Календарь доступности"
      >
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <span className="weekday" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={`blank${i}`} />
        ))}
        {Array.from({ length: total }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const day = data?.days.find((d) => d.date === date);
          const disabled = date < CALENDAR_START || date > CALENDAR_END;
          const fits = day?.withinBudget
            ? "fits"
            : day?.minPrice !== null &&
                day?.minPrice !== undefined &&
                brief.budget_kzt
              ? "over"
              : "";
          return (
            <button
              type="button"
              key={date}
              disabled={disabled}
              aria-pressed={brief.date === date}
              className={`calendar-day ${brief.date === date ? "selected" : ""} ${fits}`}
              onClick={() => onSelect(date)}
              aria-label={`${dateLabel(date)}${day ? `, ${day.available} свободно${day.minPrice !== null ? `, от ${money(day.minPrice)}` : ""}` : ""}`}
            >
              <span>{i + 1}</span>
              <small>
                {disabled
                  ? ""
                  : day?.minPrice != null
                    ? shortPrice(day.minPrice)
                    : "—"}
              </small>
            </button>
          );
        })}
      </div>
      <p className="calendar-note">
        {loading ? (
          <>
            <LoaderCircle size={12} className="spin" /> Проверяем календарь…
          </>
        ) : (
          error ||
          (!data?.ready
            ? "Выберите город, категорию и формат — появятся цены."
            : "От, в ₸ · зелёный — есть в вашем бюджете. Цена зависит от доступных анкет, это не скидка.")
        )}
      </p>
    </div>
  );
}
