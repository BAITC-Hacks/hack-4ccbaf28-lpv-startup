"use client";
import { useEffect, useRef, useState } from "react";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  CircleHelp,
  Flower2,
  LoaderCircle,
  Mic,
  Send,
  Sparkles,
  Square,
  Wallet,
  X,
  Zap,
  Heart,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import type { CatalogMeta, ChatMessage, SearchResponse } from "@/domain/api";
import type { ModelUsage, SearchQuery, RankedMatch } from "@/domain/types";
import {
  briefQuestion,
  canApplyBrief,
  missingFields,
  sameBrief,
  type Brief,
} from "@/domain/brief";
import { querySchema } from "@/domain/schema";
import { money } from "@/domain/matching";
import Calendar, { dateLabel } from "./availability-calendar";
import BriefForm, { Choice, type SetBriefField } from "./brief-form";
import ResultsPane from "./results-pane";
import {
  conversationContext,
  selectionTitle,
  type ConversationEntry,
} from "@/domain/conversation";
import {
  FAVORITES_KEY,
  readFavorites,
  type Favorite,
} from "@/domain/favorites";
import { useVoiceRecorder } from "./use-voice-recorder";

const welcome: ChatMessage = {
  role: "assistant",
  content:
    "Привет! Помогу найти людей и места для вашего события. Расскажите, что планируете: я заполню заявку, уточню детали и предложу до трёх подходящих вариантов.",
};
type BriefResponse = {
  brief: Brief;
  missing: string[];
  message: string;
  usage: ModelUsage[];
};
async function post<T>(
  path: string,
  body: unknown,
  timeout = 16000,
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers:
      body instanceof FormData
        ? undefined
        : { "Content-Type": "application/json" },
    body: body instanceof FormData ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Не удалось выполнить запрос");
  return data as T;
}
function errorText(error: unknown) {
  return error instanceof Error && error.name !== "TimeoutError"
    ? error.message
    : "Ответ задерживается. Попробуйте ещё раз; поля заявки сохранены.";
}

export default function MatchApp({ meta }: { meta: CatalogMeta }) {
  const [brief, setBrief] = useState<Brief>({});
  const briefRef = useRef<Brief>({});
  const revision = useRef(0);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [messages, setMessages] = useState<ConversationEntry[]>([welcome]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"brief" | "search" | "voice" | null>(null);
  const [error, setError] = useState("");
  const [useAI, setUseAI] = useState(meta.aiAvailable);
  const [sessionUsage, setSessionUsage] = useState<ModelUsage[]>([]);
  const [pending, setPending] = useState<BriefResponse | null>(null);
  const [toast, setToast] = useState<{
    text: string;
    target: "brief" | "results";
  } | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [started, setStarted] = useState(false);
  const voiceContext = useRef({ brief: {} as Brief, revision: 0 });
  const workspace = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const traceDialog = useRef<HTMLDialogElement>(null);
  const resultHistory = useRef<SearchResponse | null>(null);
  const [customBudget, setCustomBudget] = useState("");
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const favoritesRef = useRef<Favorite[]>([]);
  const briefDialog = useRef<HTMLDialogElement>(null);
  const favoritesDialog = useRef<HTMLDialogElement>(null);
  const manualResults = useRef<HTMLDivElement>(null);
  const manualInitialized = useRef(false);
  const [manualBrief, setManualBrief] = useState<Brief>({});
  const [manualResult, setManualResult] = useState<SearchResponse | null>(null);
  const [manualError, setManualError] = useState("");
  const [manualDateChange, setManualDateChange] = useState("");
  const [latestSearch, setLatestSearch] = useState<SearchResponse | null>(null);
  const autoScroll = useRef(true);
  useEffect(() => {
    try {
      const saved = readFavorites(localStorage.getItem(FAVORITES_KEY));
      favoritesRef.current = saved;
      setFavorites(saved);
    } catch {
      /* Storage can be disabled; session favorites still work. */
    }
  }, []);
  function toggleFavorite(
    match: RankedMatch,
    query: SearchQuery,
    explanation: string,
  ) {
    const existing = favoritesRef.current;
    const next = existing.some(
      (f) => f.match.contractor.id === match.contractor.id,
    )
      ? existing.filter((f) => f.match.contractor.id !== match.contractor.id)
      : [
          ...existing,
          { match, query, explanation, savedAt: new Date().toISOString() },
        ];
    favoritesRef.current = next;
    setFavorites(next);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      notify(
        "Браузер запретил сохранение. Избранное доступно до закрытия страницы.",
        "results",
      );
    }
  }
  function openManual(query?: Brief) {
    if (query || !manualInitialized.current) {
      setManualBrief({ ...(query ?? briefRef.current) });
      setManualResult(null);
      setManualDateChange("");
      manualInitialized.current = true;
    }
    setManualError("");
    briefDialog.current?.showModal();
  }
  const setManual: SetBriefField = (key, value) => {
    setManualBrief((previous) => {
      const next = { ...previous, [key]: value };
      if (value === undefined || value === "") delete next[key];
      return next;
    });
  };
  useEffect(() => {
    if (manualResult && briefDialog.current?.open)
      manualResults.current?.scrollIntoView({ block: "start" });
  }, [manualResult]);

  function applyBrief(next: Brief) {
    revision.current++;
    briefRef.current = next;
    setBrief(next);
    setStarted(true);
    setPending(null);
  }
  const set: SetBriefField = (key, value) => {
    const next = { ...briefRef.current, [key]: value };
    if (value === undefined || value === "") delete next[key];
    applyBrief(next);
  };
  function append(...items: ConversationEntry[]) {
    setMessages((previous) => [...previous, ...items].slice(-18));
  }
  function addUsage(items: ModelUsage[]) {
    setSessionUsage((previous) => [...previous, ...items]);
  }
  function notify(text: string, target: "brief" | "results" = "brief") {
    setToast({ text, target });
  }
  function jump(target: "brief" | "results") {
    autoScroll.current = true;
    if (target === "results") {
      const selections =
        log.current?.querySelectorAll<HTMLElement>("[data-selection]");
      selections?.[selections.length - 1]?.scrollIntoView({ block: "start" });
    } else if (log.current) log.current.scrollTop = log.current.scrollHeight;
    setToast(null);
  }
  useEffect(() => {
    if (!started || !autoScroll.current || !log.current) return;
    const last = messages[messages.length - 1];
    if (last?.selection && !busy) {
      const selections =
        log.current.querySelectorAll<HTMLElement>("[data-selection]");
      selections[selections.length - 1]?.scrollIntoView({ block: "start" });
    } else log.current.scrollTop = log.current.scrollHeight;
  }, [messages, busy, pending, brief, started]);

  async function extract(
    message: string,
    snapshot: Brief,
    requestRevision: number,
    fromVoice: boolean,
  ) {
    append({ role: "user", content: message });
    const data = await post<BriefResponse>("/api/brief", {
      message,
      brief: snapshot,
      history: conversationContext(messages),
    });
    addUsage(data.usage);
    if (canApplyBrief(requestRevision, revision.current)) {
      applyBrief(data.brief);
      append({ role: "assistant", content: data.message });
      if (fromVoice) notify("Голос разобран. Проверьте заявку");
    } else {
      setPending(data);
      append({
        role: "assistant",
        content:
          "Вы изменили поля, пока я обрабатывал сообщение. Сохранил ваши правки. Можно отдельно применить разобранный вариант.",
      });
      notify("Сообщение разобрано. Есть правки для проверки");
    }
  }
  async function sendText() {
    if (!text.trim() || busy || voice.state !== "idle") return;
    autoScroll.current = true;
    const value = text.trim();
    setBusy("brief");
    setError("");
    setText("");
    setStarted(true);
    setShowCalendar(false);
    try {
      await extract(value, briefRef.current, revision.current, false);
    } catch (e) {
      setError(errorText(e));
      setText(value);
    } finally {
      setBusy(null);
    }
  }
  function voiceStart() {
    autoScroll.current = false;
    voiceContext.current = {
      brief: { ...briefRef.current },
      revision: revision.current,
    };
    setError("");
    setToast(null);
  }
  async function onAudio(blob: Blob) {
    setBusy("voice");
    setError("");
    setStarted(true);
    try {
      const form = new FormData();
      form.set(
        "file",
        blob,
        blob.type.includes("mp4") ? "voice.mp4" : "voice.webm",
      );
      const recognized = await post<{ text: string; usage: ModelUsage }>(
        "/api/transcribe",
        form,
        25000,
      );
      addUsage([recognized.usage]);
      try {
        await extract(
          recognized.text,
          voiceContext.current.brief,
          voiceContext.current.revision,
          true,
        );
      } catch (e) {
        setText(recognized.text);
        throw e;
      }
    } catch (e) {
      const message = errorText(e);
      setError(message);
      notify(message);
    } finally {
      setBusy(null);
    }
  }
  const voice = useVoiceRecorder(onAudio, voiceStart, (message) => {
    setError(message);
    notify(message);
  });
  const locked = !!busy || voice.state !== "idle";
  const field = missingFields(brief)[0];
  const changed = result && !sameBrief(brief, result.query);

  async function confirm(
    override?: SearchQuery,
    target: "chat" | "manual" = "chat",
  ) {
    if (locked) return;
    const parsed = querySchema.safeParse(
      override ?? (target === "manual" ? manualBrief : briefRef.current),
    );
    if (!parsed.success) {
      (target === "manual" ? setManualError : setError)(
        "Проверьте поля: нужны город, категория, формат, дата 23.09–31.12.2026 и положительный бюджет.",
      );
      return;
    }
    if (override) {
      if (target === "manual") setManualBrief(override);
      else applyBrief(override);
    }
    autoScroll.current = target === "chat";
    setBusy("search");
    setError("");
    setManualError("");
    if (target === "chat") {
      setPending(null);
      setStarted(true);
      setShowCalendar(false);
      append({
        role: "user",
        content: `Подтверждаю: ${parsed.data.category}, ${parsed.data.city}, ${dateLabel(parsed.data.date)}, до ${money(parsed.data.budget_kzt)}.`,
      });
    }
    try {
      const data = await post<SearchResponse>("/api/search", {
        query: parsed.data,
        useAI,
      });
      const previous =
        target === "manual" ? manualResult : resultHistory.current;
      let changeNote = "";
      if (
        previous &&
        previous.query.date !== data.query.date &&
        previous.query.city === data.query.city &&
        previous.query.category === data.query.category
      ) {
        const nowBusy = previous.result.matches.filter((m) =>
          m.contractor.busy_dates.includes(data.query.date),
        );
        if (nowBusy.length)
          changeNote = `На ${dateLabel(data.query.date)} ${nowBusy.map((m) => m.contractor.anon_name).join(", ")} заняты по календарю каталога и исключены из подбора.`;
      }
      setLatestSearch(data);
      addUsage(data.usage);
      if (target === "manual") {
        setManualDateChange(changeNote);
        setManualResult(data);
      } else {
        resultHistory.current = data;
        setResult(data);
        const message =
          data.result.status === "matched"
            ? `${selectionTitle(data.result.matches.length)}.`
            : data.result.status === "no_category"
              ? "В этом городе пока нет анкет выбранной категории."
              : "По этим условиям подходящих вариантов нет.";
        append({
          role: "assistant",
          content: message,
          selection: data,
          dateChange: changeNote,
        });
      }
    } catch (e) {
      (target === "manual" ? setManualError : setError)(errorText(e));
    } finally {
      setBusy(null);
    }
  }
  function reset() {
    setResult(null);
    resultHistory.current = null;
    autoScroll.current = true;
    applyBrief({});
    setStarted(false);
    setMessages([welcome]);
    setShowCalendar(false);
    setError("");
    setToast(null);
  }
  function useDemo(index: number) {
    void confirm(meta.demos[index].query);
  }
  const totalCost = sessionUsage.reduce(
    (sum, u) => sum + (u.estimatedCostUsd ?? 0),
    0,
  );
  const unknownCost = sessionUsage.some((u) => u.estimatedCostUsd === null);
  const purposeLabels = {
    parse_request: "Заполнение заявки",
    explain_matches: "Объяснения по анкетам",
    transcribe: "Распознавание голоса",
  };
  const recording = voice.state === "recording";
  const voiceProcessing = voice.state === "processing" || busy === "voice";
  const micLabel = recording
    ? "Остановить и отправить запись"
    : "Начать голосовую запись";
  const micDisabled =
    !meta.aiAvailable ||
    !!busy ||
    voice.state === "permission" ||
    voice.state === "processing";

  return (
    <main className="ai-shell">
      <header className="ai-header">
        <div className="brand">
          <span className="brand-symbol">
            <Flower2 size={23} />
          </span>
          <b>
            lpv<span>match</span>
          </b>
          <span className="mode-tag">AI-режим</span>
        </div>
        <div className="header-actions">
          <button
            className="text-button"
            aria-label={`Избранное: ${favorites.length}`}
            onClick={() => favoritesDialog.current?.showModal()}
          >
            <Heart size={15} /> <span>Избранное</span>
            <b>{favorites.length}</b>
          </button>
          <button
            className="text-button"
            aria-label="Новый подбор"
            disabled={locked}
            onClick={reset}
          >
            <Plus size={16} /> <span>Новый подбор</span>
          </button>
          <button
            className="icon-button"
            aria-label="Как работает AI-подбор"
            onClick={() => traceDialog.current?.showModal()}
          >
            <CircleHelp size={18} />
          </button>
        </div>
      </header>
      <div
        id="workspace"
        className="ai-workspace conversation-workspace"
        ref={workspace}
      >
        <section
          className={`chat-panel panel ${!started ? "fresh-chat" : ""}`}
          aria-labelledby="chat-title"
        >
          <div className="panel-heading">
            <div className="assistant-symbol">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 id="chat-title">Подбор из каталога</h2>
              <p>
                {recording
                  ? "Слушаю. Нажмите ещё раз, чтобы отправить"
                  : voiceProcessing
                    ? "Разбираю голосовое сообщение…"
                    : "Помогу выбрать. Объясню почему."}
              </p>
            </div>
            <button className="brief-edit-button" onClick={() => openManual()}>
              <SlidersHorizontal size={14} /> Ручной режим
            </button>
          </div>
          <div className="context-strip" aria-label="Текущие параметры">
            <span>{brief.city || "Город не выбран"}</span>
            <span>{brief.event_format || "Тип события"}</span>
            {brief.category && <span>{brief.category}</span>}
            {brief.date && <span>{dateLabel(brief.date)}</span>}
            {brief.budget_kzt && <span>до {money(brief.budget_kzt)}</span>}
          </div>
          <div
            className="chat-log"
            ref={log}
            role="log"
            aria-label="Диалог с ассистентом"
            aria-live="polite"
          >
            {!started && (
              <div className="chat-welcome">
                <span className="welcome-symbol">
                  <Sparkles size={31} />
                </span>
                <p className="eyebrow">AI-ПОМОЩНИК В КАТАЛОГЕ</p>
                <h1>
                  Кого найдём для
                  <br />
                  <em>вашего события?</em>
                </h1>
                <p>
                  Расскажите идею — я уточню детали и выберу до трёх подходящих
                  вариантов.
                </p>
              </div>
            )}
            {messages
              .filter((_, i) => started || i !== 0)
              .map((m, i) => (
                <div
                  key={i}
                  className={`message ${m.role} ${m.selection ? "selection-message" : ""}`}
                  data-selection={m.selection ? "true" : undefined}
                >
                  <span className="message-author">
                    {m.role === "assistant" ? "LPV ASSISTANT" : "ВЫ"}
                  </span>
                  <p>{m.content}</p>
                  {m.selection && (
                    <ResultsPane
                      layout="chat"
                      result={m.selection}
                      favorites={favorites}
                      onToggleFavorite={toggleFavorite}
                      onSearch={(query) => void confirm(query)}
                      onEdit={() => openManual(m.selection!.query)}
                      busy={locked}
                      dateChange={m.dateChange}
                    />
                  )}
                </div>
              ))}
            {!started && (
              <div
                className="chat-examples"
                aria-label="Готовые запросы — нажмите, чтобы найти варианты"
              >
                {meta.demos.map((demo, i) => (
                  <button
                    key={demo.label}
                    disabled={locked}
                    onClick={() => useDemo(i)}
                  >
                    <span>
                      {i === 0 ? (
                        <Mic size={17} />
                      ) : i === 1 ? (
                        <Flower2 size={17} />
                      ) : (
                        <Wallet size={17} />
                      )}
                    </span>
                    <strong>{demo.label}</strong>
                    <small>{demo.detail}</small>
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
            )}
            {busy && (
              <div className="assistant-working">
                <LoaderCircle size={15} className="spin" />
                {busy === "search"
                  ? "Проверяю анкеты и ограничения…"
                  : busy === "voice"
                    ? "Распознаю и заполняю заявку…"
                    : "Разбираю сообщение…"}
              </div>
            )}
            {pending && (
              <div className="pending-brief">
                <strong>Разобранный вариант</strong>
                <p>{Object.values(pending.brief).join(" · ")}</p>
                <button
                  className="button secondary"
                  onClick={() => {
                    applyBrief(pending.brief);
                    append({ role: "assistant", content: pending.message });
                  }}
                >
                  Применить этот вариант
                </button>
                <button
                  className="text-button"
                  onClick={() => setPending(null)}
                >
                  Оставить мои правки
                </button>
              </div>
            )}
            {started && !busy && !pending && (!result || changed) && (
              <div className="chat-controls">
                <p className="control-question">{briefQuestion(brief)}</p>
                {showCalendar || field === "date" ? (
                  <Calendar
                    brief={brief}
                    onSelect={(date) => {
                      set("date", date);
                      setShowCalendar(false);
                    }}
                  />
                ) : field === "city" ? (
                  <div className="quick-options">
                    {meta.cities.map((city) => (
                      <button key={city} onClick={() => set("city", city)}>
                        {city}
                      </button>
                    ))}
                  </div>
                ) : field === "category" ? (
                  <Choice
                    label="Выберите категорию в чате"
                    options={meta.categories}
                    value={brief.category}
                    onChange={(v) => set("category", v || undefined)}
                  />
                ) : field === "event_format" ? (
                  <div className="quick-options">
                    {meta.formats.map((format) => (
                      <button
                        key={format}
                        onClick={() => set("event_format", format)}
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                ) : field === "budget_kzt" ? (
                  <div>
                    <div className="quick-options">
                      {[400000, 700000, 1000000].map((budget) => (
                        <button
                          key={budget}
                          onClick={() => set("budget_kzt", budget)}
                        >
                          {money(budget)}
                        </button>
                      ))}
                    </div>
                    <div className="inline-budget">
                      <label className="field">
                        <span>Свой бюджет, ₸</span>
                        <input
                          type="number"
                          min="1"
                          max="100000000"
                          inputMode="numeric"
                          placeholder="Введите сумму"
                          value={customBudget}
                          onChange={(e) => setCustomBudget(e.target.value)}
                        />
                      </label>
                      <button
                        className="icon-button"
                        aria-label="Применить свой бюджет"
                        disabled={
                          Number(customBudget) <= 0 ||
                          Number(customBudget) > 100000000
                        }
                        onClick={() => {
                          set("budget_kzt", Number(customBudget));
                          setCustomBudget("");
                        }}
                      >
                        <Check size={20} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="confirmation">
                    <span>
                      <Check size={14} /> Всё необходимое собрано
                    </span>
                    <div>
                      <button
                        className="button primary"
                        disabled={locked}
                        onClick={() => void confirm()}
                      >
                        Подобрать варианты <ArrowRight size={15} />
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setShowCalendar(true)}
                      >
                        <CalendarDays size={15} /> Сравнить даты
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="chat-bottom">
            <p className="input-guide">
              Назовите город, дату, тип события, кого ищете и бюджет. Язык и
              длительность — по желанию.
            </p>
            <div className="chat-error" role="status">
              {error}
            </div>
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                void sendText();
              }}
            >
              <textarea
                aria-label="Сообщение ассистенту"
                rows={2}
                maxLength={1800}
                placeholder={
                  meta.aiAvailable
                    ? "Расскажите о вашем событии…"
                    : "Для AI-чата нужен API-ключ; форма работает локально"
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!meta.aiAvailable}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    void sendText();
                  }
                }}
              />
              <div className="composer-actions">
                <button
                  type="button"
                  className={`icon-button ${recording ? "recording" : ""}`}
                  aria-label={`${micLabel} в чате`}
                  aria-pressed={recording}
                  disabled={micDisabled}
                  onClick={() => void voice.toggle()}
                >
                  {recording ? (
                    <Square size={17} />
                  ) : voiceProcessing || voice.state === "permission" ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    <Mic size={18} />
                  )}
                </button>
                <button
                  className="send-button"
                  type="submit"
                  aria-label="Отправить сообщение"
                  disabled={locked || !text.trim() || !meta.aiAvailable}
                >
                  <Send size={17} />
                </button>
              </div>
            </form>
            {voice.state !== "idle" && (
              <div className="composer-voice-status" role="status">
                <span>
                  {recording ? (
                    <>
                      <i className="record-dot" />
                      {Math.floor(voice.seconds / 60)}:
                      {String(voice.seconds % 60).padStart(2, "0")} · Нажмите
                      микрофон, чтобы отправить
                    </>
                  ) : voice.state === "permission" ? (
                    "Разрешите микрофон в браузере"
                  ) : (
                    "Обрабатываю запись…"
                  )}
                </span>
                {(recording || voice.state === "permission") && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={voice.cancel}
                    aria-label="Отменить запись"
                  >
                    Отменить
                  </button>
                )}
              </div>
            )}
            <p className="privacy-note">
              До 60 секунд · аудио отправляется в OpenAI для распознавания
            </p>
          </div>
        </section>
      </div>
      <div className="ai-footer">
        <span>
          Демо AI-режима · LPV Startup · {meta.count} анкет организаторов
        </span>
        <button
          className="text-button"
          onClick={() => traceDialog.current?.showModal()}
        >
          <Zap size={12} /> Модели и расход API
        </button>
      </div>
      <dialog
        className="brief-dialog manual-dialog"
        aria-label="Ручной режим"
        ref={briefDialog}
        onClick={(e) => {
          if (e.target === e.currentTarget) briefDialog.current?.close();
        }}
      >
        <div className="brief-dialog-close">
          <button
            className="icon-button"
            aria-label="Закрыть ручной режим"
            onClick={() => briefDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <BriefForm
          brief={manualBrief}
          meta={meta}
          set={setManual}
          onConfirm={() => void confirm(undefined, "manual")}
          onReset={() => {
            setManualBrief({});
            setManualResult(null);
            setManualDateChange("");
            setManualError("");
          }}
          busy={locked}
          useAI={useAI}
          onAI={setUseAI}
        />
        {manualError && (
          <p className="manual-error" role="alert">
            {manualError}
          </p>
        )}
        <div ref={manualResults} className="manual-result-area">
          {manualResult && (
            <ResultsPane
              layout="manual"
              result={manualResult}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              onSearch={(query) => void confirm(query, "manual")}
              onEdit={() =>
                briefDialog.current?.scrollTo({ top: 0, behavior: "smooth" })
              }
              busy={locked}
              changed={!sameBrief(manualBrief, manualResult.query)}
              dateChange={manualDateChange}
            />
          )}
        </div>
      </dialog>
      <dialog
        className="favorites-dialog"
        ref={favoritesDialog}
        aria-label="Избранное"
        onClick={(e) => {
          if (e.target === e.currentTarget) favoritesDialog.current?.close();
        }}
      >
        <div className="brief-dialog-close">
          <button
            className="icon-button"
            aria-label="Закрыть избранное"
            onClick={() => favoritesDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <ResultsPane
          layout="favorites"
          result={null}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          busy={locked}
          onSearch={(query) => {
            favoritesDialog.current?.close();
            void confirm(query);
          }}
          onEdit={() => favoritesDialog.current?.close()}
        />
      </dialog>
      {toast && (
        <div className="ready-toast" role="status">
          <button onClick={() => jump(toast.target)}>
            <span className="toast-icon">
              <Check size={18} />
            </span>
            <span>
              {toast.text}
              <small>Нажмите, чтобы перейти</small>
            </span>
            {toast.target === "results" ? (
              <ArrowDown size={18} />
            ) : (
              <ArrowUp size={18} />
            )}
          </button>
          <button
            className="icon-button"
            aria-label="Закрыть уведомление"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <dialog
        className="trace-dialog"
        ref={traceDialog}
        onClick={(e) => {
          if (e.target === e.currentTarget) traceDialog.current?.close();
        }}
      >
        <div className="dialog-title">
          <div>
            <span className="eyebrow">ПРОЗРАЧНЫЙ ПОДБОР</span>
            <h2>Что делает AI</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Закрыть детали подбора"
            onClick={() => traceDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <div className="routing-grid">
          <div>
            <Mic size={20} />
            <h3>Голос → текст</h3>
            <p>
              Компактная модель транскрипции. Запись не сохраняется приложением.
            </p>
          </div>
          <div>
            <Sparkles size={20} />
            <h3>Текст → заявка</h3>
            <p>
              Быстрая nano-модель извлекает поля. Пропуски уточняются, поиск —
              после подтверждения.
            </p>
          </div>
          <div>
            <Check size={20} />
            <h3>Каталог → совпадения</h3>
            <p>
              Код проверяет ограничения и порядок. Mini для сложных пожеланий,
              nano для простых объяснений. Цитаты сверяются с анкетами.
            </p>
          </div>
        </div>
        <p className="info-note">
          Календарь, фильтры и альтернативы работают без LLM. Одинаковые
          AI-запросы кешируются на 30 минут. Фото и репутация не влияют на
          ранжирование.
        </p>
        <h3>Расход в этой сессии</h3>
        <p className="cost-total">
          ≈ ${totalCost.toFixed(5)}
          {unknownCost && <small> + стоимость аудио не оценена</small>}
        </p>
        {!sessionUsage.length && (
          <p className="subtle">Пока ни одного вызова API.</p>
        )}
        <div className="usage-list">
          {sessionUsage.slice(-12).map((u, i) => (
            <div key={i}>
              <strong>{purposeLabels[u.purpose]}</strong>
              <code>{u.model}</code>
              <span>
                {u.cached
                  ? "локальный кеш · $0"
                  : `${u.inputTokens} → ${u.outputTokens} токенов · ${(u.latencyMs / 1000).toFixed(2)} с · ${u.estimatedCostUsd === null ? "цена не оценена" : `≈ $${u.estimatedCostUsd.toFixed(5)}`}`}
              </span>
            </div>
          ))}
        </div>
        {latestSearch && (
          <>
            <h3>Последний подбор</h3>
            <ol className="trace-list">
              {latestSearch.trace.map((step, i) => (
                <li key={i}>
                  <strong>{step.label}</strong>
                  <p>{step.detail}</p>
                </li>
              ))}
            </ol>
          </>
        )}
        <p className="subtle">
          Оценка стоимости, не счёт провайдера. Тарифы и имена моделей
          настраиваются на сервере.
        </p>
      </dialog>
    </main>
  );
}
