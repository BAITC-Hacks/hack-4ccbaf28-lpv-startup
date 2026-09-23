"use client";
import { useRef } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  LoaderCircle,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Brief } from "@/domain/brief";
import { missingFields } from "@/domain/brief";
import type { CatalogMeta } from "@/domain/api";
import { CALENDAR_START, CALENDAR_END } from "@/domain/schema";
import Calendar from "./availability-calendar";

export type SetBriefField = <K extends keyof Brief>(
  key: K,
  value: Brief[K],
) => void;
export function Choice({
  label,
  value,
  options,
  onChange,
  optional = false,
}: {
  label: string;
  value?: string;
  options: string[];
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {optional && <small>необязательно</small>}
      </span>
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{optional ? "Не важно" : "Выберите"}</option>
        {value && !options.includes(value) && (
          <option value={value}>{value}</option>
        )}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function BriefForm({
  brief,
  meta,
  set,
  onConfirm,
  onReset,
  busy,
  useAI,
  onAI,
}: {
  brief: Brief;
  meta: CatalogMeta;
  set: SetBriefField;
  onConfirm: () => void;
  onReset: () => void;
  busy: boolean;
  useAI: boolean;
  onAI: (value: boolean) => void;
}) {
  const calendarDialog = useRef<HTMLDialogElement>(null);
  const missing = missingFields(brief);
  return (
    <section className="brief-panel panel" aria-labelledby="brief-title">
      <div className="panel-heading">
        <div className="heading-icon">
          <SlidersHorizontal size={19} />
        </div>
        <div>
          <h2 id="brief-title">Ручной режим</h2>
          <p>Выберите условия — результаты появятся ниже</p>
        </div>
        <button
          type="button"
          className="text-button reset"
          onClick={onReset}
          disabled={busy}
        >
          Сбросить
        </button>
      </div>
      <div className="brief-progress">
        <span>Параметры события</span>
        <span>
          {5 - missing.length} из 5 <Check size={13} />
        </span>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <div className="field-grid">
          <Choice
            label="Город"
            value={brief.city}
            options={meta.cities}
            onChange={(v) => set("city", v || undefined)}
          />
          <Choice
            label="Кого ищем"
            value={brief.category}
            options={meta.categories}
            onChange={(v) => set("category", v || undefined)}
          />
          <Choice
            label="Формат события"
            value={brief.event_format}
            options={meta.formats}
            onChange={(v) => set("event_format", v || undefined)}
          />
          <label className="field">
            <span>
              Дата события{" "}
              <button
                className="text-button"
                type="button"
                onClick={() => calendarDialog.current?.showModal()}
                aria-label="Открыть календарь с ценами"
              >
                <CalendarDays size={12} /> цены
              </button>
            </span>
            <input
              type="date"
              min={CALENDAR_START}
              max={CALENDAR_END}
              value={brief.date || ""}
              onChange={(e) => set("date", e.target.value || undefined)}
            />
          </label>
          <label className="field">
            <span>Бюджет на одного, ₸</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="100000000"
              placeholder="Например, 800 000"
              value={brief.budget_kzt ?? ""}
              onChange={(e) =>
                set(
                  "budget_kzt",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
            />
          </label>
          <label className="field">
            <span>
              Длительность, ч <small>необязательно</small>
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0.5"
              max="24"
              step="0.5"
              placeholder="Например, 5"
              value={brief.hours ?? ""}
              onChange={(e) =>
                set(
                  "hours",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
            />
          </label>
          <div className="full">
            <Choice
              label="Язык проведения"
              value={brief.language}
              options={meta.languages}
              optional
              onChange={(v) => set("language", v || undefined)}
            />
          </div>
          <label className="field full">
            <span>
              Что для вас важно? <small>необязательно</small>
            </span>
            <textarea
              rows={2}
              maxLength={1200}
              placeholder="Атмосфера, стиль, особые пожелания…"
              value={brief.preferences || ""}
              onChange={(e) => set("preferences", e.target.value || undefined)}
            />
          </label>
        </div>
        <label className="ai-toggle">
          <input
            type="checkbox"
            checked={useAI}
            disabled={!meta.aiAvailable}
            onChange={(e) => onAI(e.target.checked)}
          />
          <span>AI-объяснения подбора</span>
          <small>{meta.aiAvailable ? "экономный режим" : "без API"}</small>
        </label>
        <button
          type="submit"
          className="button primary confirm-button"
          disabled={busy || missing.length > 0}
        >
          {busy ? (
            <LoaderCircle size={18} className="spin" />
          ) : (
            <ArrowRight size={18} />
          )}{" "}
          Найти до 3 вариантов
        </button>
        <p className="form-footnote">
          До 3 вариантов · цены от · без бронирования
        </p>
      </form>
      <dialog
        className="calendar-dialog"
        ref={calendarDialog}
        onClick={(e) => {
          if (e.target === e.currentTarget) calendarDialog.current?.close();
        }}
      >
        <div className="dialog-title">
          <div>
            <span className="eyebrow">ДАТА СОБЫТИЯ</span>
            <h2>Выберите день</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Закрыть календарь"
            onClick={() => calendarDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <Calendar
          brief={brief}
          onSelect={(date) => {
            set("date", date);
            calendarDialog.current?.close();
          }}
        />
      </dialog>
    </section>
  );
}
