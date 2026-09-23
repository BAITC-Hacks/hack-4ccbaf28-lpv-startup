"use client";

import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Clock3,
  Code2,
  Flower2,
  Globe2,
  LoaderCircle,
  MapPin,
  Mic2,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import type { CatalogMeta, ChatMessage, SearchResponse } from "@/domain/api";
import type { ModelUsage, SearchQuery } from "@/domain/types";
import { money } from "@/domain/matching";
import { CALENDAR_END, CALENDAR_START } from "@/domain/schema";

const reasons = {
  busy_date: "заняты на дату",
  over_budget: "выше бюджета",
  event_format: "другой формат",
  language: "не подходит язык",
  duration: "недостаточно часов",
};
const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
const usd = (n: number) => "$" + n.toFixed(5);

export default function MatchApp({
  meta,
  initial,
}: {
  meta: CatalogMeta;
  initial: SearchResponse;
}) {
  const [query, setQuery] = useState<SearchQuery>(initial.query);
  const [result, setResult] = useState<SearchResponse>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"search" | "agent" | null>(null);
  const [error, setError] = useState("");
  const [clarification, setClarification] = useState("");
  const [useAI, setUseAI] = useState(true);
  const [lastMessage, setLastMessage] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [sessionUsage, setSessionUsage] = useState<ModelUsage[]>([]);
  const panel = useRef<HTMLDialogElement>(null);
  const changed = JSON.stringify(query) !== JSON.stringify(result.query);
  const set = <K extends keyof SearchQuery>(field: K, value: SearchQuery[K]) =>
    setQuery((previous) => ({ ...previous, [field]: value }));

  async function request(kind: "search" | "agent", override?: SearchQuery) {
    if (busy) return;
    setBusy(kind);
    setError("");
    setClarification("");
    const active = override ?? query;
    try {
      const response = await fetch(`/api/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "agent"
            ? { message: text, query: active, history, useAI }
            : { query: active, useAI },
        ),
        signal: AbortSignal.timeout(18000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Не удалось выполнить подбор");
      if (kind === "agent") {
        setLastMessage(text);
        setText("");
        setHistory((previous) =>
          [
            ...previous,
            { role: "user" as const, content: text },
            {
              role: "assistant" as const,
              content:
                data.clarification ??
                "Подбор выполнен. Поля формы обновлены по запросу.",
            },
          ].slice(-4),
        );
      } else {
        setHistory([]);
        setLastMessage("");
      }
      if (data.usage)
        setSessionUsage((previous) => [...previous, ...data.usage]);
      if (data.clarification) {
        setClarification(data.clarification);
        return;
      }
      setResult(data);
      setQuery(data.query);
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "TimeoutError"
          ? e.message
          : "Ответ задерживается. Попробуйте снова или отключите AI-объяснения.",
      );
    } finally {
      setBusy(null);
    }
  }

  const count = result.result.matches.length;
  const totalCost = sessionUsage.reduce(
    (sum, u) => sum + (u.estimatedCostUsd ?? 0),
    0,
  );
  const cached = result.usage.length > 0 && result.usage.every((u) => u.cached);

  return (
    <>
      <header className="topbar">
        <a className="brand" href="/" aria-label="LPV Match — на главную">
          <span className="brand-mark">
            <AudioLines size={21} />
          </span>
          lpv<span className="brand-light">match</span>
          <span className="brand-dot">.</span>
        </a>
        <div className="nav-caption">Нужные люди. Ваше событие.</div>
        <button
          className="trace-button"
          onClick={() => panel.current?.showModal()}
        >
          <Code2 size={16} />
          <span>Как это работает</span>
          <ArrowUpRight size={14} />
        </button>
      </header>

      <main className="shell">
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span className="tiny-star">✳</span> ВАШ СОБЫТИЙНЫЙ КОНСЬЕРЖ
            </div>
            <h1>
              Хорошее событие
              <br />
              начинается <em>с людей.</em>
            </h1>
            <p>
              Подберём подрядчиков, которым подходит ваша дата,
              <br className="desktop-break" /> бюджет и настроение. И объясним
              каждый выбор.
            </p>
          </div>
          <div className="catalog-note">
            <div className="orbit">
              <div className="orbit-inner">
                <Flower2 size={44} strokeWidth={1.1} />
              </div>
              <span className="orbit-dot a" />
              <span className="orbit-dot b" />
              <span className="orbit-dot c" />
            </div>
            <div>
              <strong>{meta.count}</strong>
              <span>анкет в каталоге Firebird</span>
              <small>{meta.categories.length} категорий · 3 географии</small>
            </div>
          </div>
        </section>

        <div className="workspace">
          <aside className="brief-panel">
            <div className="panel-heading">
              <span className="step-number">01</span>
              <h2>Ваше событие</h2>
              <SlidersHorizontal size={17} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void request("search");
              }}
            >
              <fieldset disabled={!!busy}>
                <div className="field-row">
                  <label>
                    Город
                    <select
                      value={query.city}
                      onChange={(e) => set("city", e.target.value)}
                    >
                      {!meta.cities.includes(query.city) && (
                        <option>{query.city}</option>
                      )}
                      {meta.cities.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Дата
                    <input
                      aria-label="Дата мероприятия"
                      type="date"
                      required
                      min={CALENDAR_START}
                      max={CALENDAR_END}
                      value={query.date}
                      onChange={(e) => set("date", e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Кого ищем
                  <select
                    value={query.category}
                    onChange={(e) => set("category", e.target.value)}
                  >
                    {!meta.categories.includes(query.category) && (
                      <option>{query.category}</option>
                    )}
                    {meta.categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Формат события
                  <select
                    value={query.event_format}
                    onChange={(e) => set("event_format", e.target.value)}
                  >
                    {!meta.formats.includes(query.event_format) && (
                      <option>{query.event_format}</option>
                    )}
                    {meta.formats.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Бюджет на подрядчика, до
                  <div className="money-input">
                    <input
                      aria-label="Бюджет в тенге"
                      type="number"
                      min="1"
                      max="100000000"
                      required
                      value={query.budget_kzt || ""}
                      onChange={(e) =>
                        set("budget_kzt", Number(e.target.value))
                      }
                    />
                    <span>₸</span>
                  </div>
                </label>
                <div className="field-row">
                  <label>
                    Язык
                    <select
                      value={query.language ?? ""}
                      onChange={(e) =>
                        set("language", e.target.value || undefined)
                      }
                    >
                      <option value="">Любой</option>
                      {query.language &&
                        !meta.languages.includes(query.language) && (
                          <option>{query.language}</option>
                        )}
                      {meta.languages.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Длительность, ч
                    <input
                      aria-label="Длительность в часах"
                      type="number"
                      placeholder="Неважно"
                      min="0.5"
                      max="24"
                      step="0.5"
                      value={query.hours ?? ""}
                      onChange={(e) =>
                        set(
                          "hours",
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                    />
                  </label>
                </div>
                <label>
                  Какую атмосферу создаём?
                  <textarea
                    className="preferences"
                    maxLength={1200}
                    value={query.preferences ?? ""}
                    placeholder="Камерный вечер, живой юмор, без навязчивых конкурсов…"
                    onChange={(e) => set("preferences", e.target.value)}
                  />
                </label>
                <label className="switch-row">
                  <span>
                    <Sparkles size={15} /> AI-объяснения
                  </span>
                  <input
                    type="checkbox"
                    checked={useAI}
                    onChange={(e) => setUseAI(e.target.checked)}
                    aria-label="Использовать AI для объяснений"
                  />
                  <span className="switch-track" aria-hidden="true" />
                </label>
                <button className="primary-button" type="submit">
                  {busy ? (
                    <>
                      <LoaderCircle className="spin" size={18} /> Подбираем…
                    </>
                  ) : (
                    <>
                      Найти своих людей <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </fieldset>
            </form>
            <p className="form-footnote">
              <CalendarDays size={14} /> Календарь: 23.09 — 31.12.2026
              <br />
              <span>Цены в каталоге указаны «от».</span>
            </p>
          </aside>

          <section className="results-area" aria-label="Подбор подрядчиков">
            <div className="assistant-box">
              <div className="assistant-title">
                <span className="sparkle-box">
                  <Sparkles size={18} />
                </span>
                <div>
                  <h2>Или просто расскажите</h2>
                  <p>Я заполню детали и проверю каталог.</p>
                </div>
                <span
                  className={`ai-status ${meta.aiAvailable ? "" : "offline"}`}
                >
                  <i />
                  {meta.aiAvailable ? "AI готов" : "Без API"}
                </span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (text.trim()) void request("agent");
                }}
              >
                <textarea
                  aria-label="Запрос помощнику"
                  value={text}
                  maxLength={1800}
                  disabled={!!busy}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Нужен ведущий в Алматы на 15 октября. Корпоратив, миллион тенге, спокойно и с юмором…"
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      (e.metaKey || e.ctrlKey) &&
                      text.trim()
                    ) {
                      e.preventDefault();
                      void request("agent");
                    }
                  }}
                />
                <button
                  aria-label="Отправить запрос помощнику"
                  disabled={!!busy || !text.trim()}
                  type="submit"
                >
                  {busy === "agent" ? (
                    <LoaderCircle className="spin" size={19} />
                  ) : (
                    <ArrowUpRight size={21} />
                  )}
                </button>
              </form>
              {lastMessage && (
                <div className="last-request">
                  <CheckCheck size={14} />
                  <span>{lastMessage}</span>
                </div>
              )}
              {clarification && (
                <p className="clarification" role="status">
                  <CircleHelp size={17} />
                  {clarification}
                </p>
              )}
            </div>

            <div className="demo-row">
              <span>Попробовать</span>
              {meta.demos.map((demo, index) => (
                <button
                  key={demo.label}
                  title={demo.detail}
                  disabled={!!busy}
                  onClick={() => {
                    setQuery(demo.query);
                    void request("search", demo.query);
                  }}
                >
                  {index === 0 ? (
                    <Mic2 size={13} />
                  ) : index === 1 ? (
                    <Flower2 size={13} />
                  ) : (
                    <Wallet size={13} />
                  )}
                  {demo.label}
                </button>
              ))}
            </div>
            {error && (
              <div className="error-note" role="alert">
                {error}
              </div>
            )}
            {changed && !busy && (
              <div className="pending-note">
                Параметры изменены. Нажмите «Найти своих людей», чтобы обновить
                подбор.
              </div>
            )}

            <div className="results-heading" aria-live="polite">
              <div>
                <div className="eyebrow">02 / ПОДБОР ПОД ВАШ ЗАПРОС</div>
                <h2>
                  {count ? (
                    <>
                      Ваш короткий список{" "}
                      <span>{count.toString().padStart(2, "0")}</span>
                    </>
                  ) : (
                    "Найдём другой подход"
                  )}
                </h2>
              </div>
              <span className="result-date">
                <CalendarDays size={14} />
                {dateLabel(result.query.date)}
              </span>
            </div>
            <div
              className={`result-content ${busy ? "is-loading" : ""}`}
              aria-busy={!!busy}
            >
              {result.notice && (
                <p className="notice" role="status">
                  {result.notice}
                </p>
              )}
              {count > 0 && (
                <div className="selection-note">
                  <Check size={14} />
                  <span>
                    Все обязательные условия проверены
                    {result.result.status === "matched" &&
                    result.result.totalEligible > 3
                      ? ` · показаны 3 из ${result.result.totalEligible}`
                      : ""}
                  </span>
                  <span className="explanation-tag">
                    {result.explanationMode === "ai"
                      ? "AI + проверенные цитаты"
                      : "Объяснения по каталогу"}
                  </span>
                </div>
              )}
              <div className="cards">
                {result.result.matches.map((match, index) => {
                  const c = match.contractor;
                  const initialLetters = c.anon_name
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("");
                  return (
                    <article
                      className={`contractor-card tone-${index}`}
                      key={c.id}
                    >
                      <div className="card-top">
                        <div className="avatar">
                          {initialLetters}
                          <span>0{index + 1}</span>
                        </div>
                        <div className="identity">
                          <div className="card-kicker">
                            {result.query.category} <span>·</span>{" "}
                            <MapPin size={11} /> {c.city}
                          </div>
                          <h3>{c.anon_name}</h3>
                        </div>
                        <div className="price">
                          <small>от</small> {money(c.price_from_kzt)}
                          <span>за мероприятие</span>
                        </div>
                      </div>
                      <div className="card-facts">
                        <span className="available">
                          <i />
                          Свободен {dateLabel(result.query.date)}
                        </span>
                        <span>
                          <Globe2 size={13} />
                          {c.languages.join(" / ")}
                        </span>
                        <span>
                          <Clock3 size={13} />
                          {c.max_hours
                            ? `до ${c.max_hours} ч`
                            : "Без почасового лимита"}
                        </span>
                      </div>
                      <div className="why">
                        <Sparkles size={15} />
                        <div>
                          <h4>Почему в подборке</h4>
                          <p>{result.explanations[c.id]}</p>
                        </div>
                      </div>
                      <details className="profile-details">
                        <summary>
                          Основания и полная анкета <ChevronDown size={15} />
                        </summary>
                        <div className="profile-content">
                          <ul>
                            {match.evidence.map((e) => (
                              <li key={e.criterion}>
                                <Check size={13} />
                                {e.fact}
                              </li>
                            ))}
                          </ul>
                          <p>{c.description}</p>
                          <div className="provenance">
                            <code>{c.id}</code>
                            {c.synthetic && <span>Синтетическая анкета</span>}
                            {c.price_imputed && (
                              <span>Цена дополнена организаторами</span>
                            )}
                            {c.city_imputed && (
                              <span>Город дополнен организаторами</span>
                            )}
                            <span>
                              Ранг: {match.score} баллов, не оценка качества
                            </span>
                          </div>
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>

              {result.result.status === "no_category" && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <MapPin size={28} />
                  </div>
                  <h3>Такой категории пока нет в городе</h3>
                  <p>
                    В каталоге нет анкет категории «{result.query.category}» для
                    «{result.query.city}». Измените город или категорию в форме.
                  </p>
                </div>
              )}
              {result.result.status === "no_matches" && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <SlidersHorizontal size={27} />
                  </div>
                  <h3>Условия пока не совпали</h3>
                  <p>
                    В городе есть {result.result.candidatesInCity} анкет этой
                    категории, но ни одна не проходит все ограничения.
                  </p>
                </div>
              )}
              {result.result.status !== "no_category" && count < 3 && (
                <div className="constraints">
                  <h3>
                    {count
                      ? `Почему в подборке ${count}, а не 3?`
                      : "Что ограничивает выбор"}
                  </h3>
                  <div>
                    {Object.entries(result.result.rejected)
                      .filter(([, n]) => n > 0)
                      .map(([reason, n]) => (
                        <span key={reason}>
                          <b>{n}</b> {reasons[reason as keyof typeof reasons]}
                        </span>
                      ))}
                  </div>
                  <small>Одна анкета может не пройти несколько условий.</small>
                  {count > 0 &&
                    !Object.values(result.result.rejected).some(Boolean) && (
                      <p>В городе и категории всего {count} анкет.</p>
                    )}
                </div>
              )}
              {result.alternatives.length > 0 && (
                <div className="alternatives">
                  <div>
                    <Sparkles size={17} />
                    <h3>Есть варианты</h3>
                  </div>
                  <p>Меняем только одно условие. Остальные остаются в силе.</p>
                  {result.alternatives.map((option) => (
                    <button
                      key={option.kind}
                      disabled={!!busy}
                      onClick={() => {
                        setQuery(option.query);
                        void request("search", option.query);
                      }}
                    >
                      <span>
                        {option.label}
                        <small>Подходит анкет: {option.eligible}</small>
                      </span>
                      <ArrowRight size={17} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              className="run-summary"
              onClick={() => panel.current?.showModal()}
            >
              <span>
                <Zap size={14} />
                {cached
                  ? "Из кеша"
                  : `${(result.elapsedMs / 1000).toFixed(2)} с`}
                <i />
                {result.usage.length
                  ? result.usage
                      .map((u) => u.model)
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .join(" + ")
                  : "Локальный поиск · без API"}
              </span>
              <span>
                Посмотреть выполнение <ArrowUpRight size={13} />
              </span>
            </button>
          </section>
        </div>
        <footer>
          <span className="footer-brand">lpv match.</span>
          <span>Firebird · Креативные индустрии · HackAlem 2026</span>
          <span>Вы выбираете. Мы помогаем разобраться.</span>
        </footer>
      </main>

      <dialog
        ref={panel}
        className="tech-dialog"
        onClick={(e) => {
          if (e.target === panel.current) panel.current.close();
        }}
      >
        <div className="dialog-content">
          <div className="dialog-heading">
            <div>
              <div className="eyebrow">ПРОЗРАЧНОЕ ВЫПОЛНЕНИЕ</div>
              <h2>За каждым выбором — факты.</h2>
            </div>
            <button
              aria-label="Закрыть панель"
              onClick={() => panel.current?.close()}
            >
              <X size={22} />
            </button>
          </div>
          <p className="dialog-lead">
            Модели помогают понять пожелания. Доступность, ограничения и порядок
            результатов проверяет код.
          </p>
          <div className="trace-list">
            {result.trace.map((step, i) => (
              <div className="trace-item" key={i}>
                <span>{i + 1}</span>
                <div>
                  <h3>
                    {step.label}
                    <small>
                      {step.kind === "code"
                        ? "КОД"
                        : step.kind === "cache"
                          ? "КЕШ"
                          : "МОДЕЛЬ"}
                    </small>
                  </h3>
                  <p>{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <h3 className="section-label">API этого подбора</h3>
          {result.usage.length ? (
            <div className="usage-table">
              {result.usage.map((u, i) => (
                <div key={i}>
                  <div>
                    <strong>{u.model}</strong>
                    <small>
                      {u.purpose === "parse_request"
                        ? "Разбор запроса"
                        : "Выбор оснований объяснения"}
                      {u.cached ? " · локальный кеш" : ""}
                    </small>
                  </div>
                  <div>
                    <strong>
                      {u.estimatedCostUsd === null
                        ? "Цена неизвестна"
                        : usd(u.estimatedCostUsd)}
                    </strong>
                    <small>
                      {u.inputTokens} вх. / {u.outputTokens} вых. ·{" "}
                      {u.latencyMs} мс
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-api">
              В этом подборе модель не вызывалась. Поиск по 66 анкетам и
              проверка календаря выполняются локально.
            </p>
          )}
          <div className="session-cost">
            <div>
              <small>ОЦЕНОЧНЫЙ РАСХОД В ЭТОЙ ВКЛАДКЕ</small>
              <strong>{usd(totalCost)}</strong>
            </div>
            <span>
              {sessionUsage.length} операций
              <br />
              {sessionUsage.filter((u) => u.cached).length} из кеша
            </span>
          </div>
          <p className="fine-print">
            Токены — из ответа API, стоимость — расчёт по тарифам OpenAI на
            23.09.2026, без налогов. Не является счётом. Неизвестная стоимость
            моделей и незавершённые запросы в сумму не включены. Кеш живёт 30
            минут в памяти процесса.
          </p>
          <div className="routing-note">
            <Code2 size={20} />
            <p>
              <b>Экономия заложена в архитектуру.</b> Nano разбирает текст и
              простые объяснения. Mini используется при пожеланиях к стилю или
              сочетании языка и часов. Объясняющая модель видит только три
              выбранные анкеты. Цитаты проверяются точным сравнением, порядок
              результатов модель не меняет.
            </p>
          </div>
          <div className="data-note">
            <b>О данных</b>
            <p>
              66 анкет организаторов, из них 13 синтетических. Календарь и цены
              учебные. Доступность означает отсутствие даты в календаре
              занятости каталога. Ранжирование учитывает лексические признаки
              пожеланий и запас бюджета; оценку качества исполнителя не
              вычисляем. Бронирование в MVP не предусмотрено.
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}
