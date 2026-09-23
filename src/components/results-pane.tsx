"use client";
import {
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  Heart,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { SearchResponse } from "@/domain/api";
import type { Favorite } from "@/domain/favorites";
import type { RankedMatch, SearchQuery } from "@/domain/types";
import { selectionTitle } from "@/domain/conversation";
import { money } from "@/domain/matching";
import { dateLabel } from "./availability-calendar";
import ContractorCard from "./contractor-card";
const reasons = {
  busy_date: "заняты на дату",
  over_budget: "выше бюджета",
  event_format: "другой формат",
  language: "другой язык",
  duration: "недостаточно часов",
};
export default function ResultsPane({
  result,
  favorites,
  layout = "chat",
  onToggleFavorite,
  onSearch,
  onEdit,
  busy,
  changed = false,
  dateChange = "",
}: {
  result: SearchResponse | null;
  favorites: Favorite[];
  layout?: "chat" | "manual" | "favorites";
  onToggleFavorite: (
    match: RankedMatch,
    query: SearchQuery,
    explanation: string,
  ) => void;
  onSearch: (query: SearchQuery) => void;
  onEdit: () => void;
  busy: boolean;
  changed?: boolean;
  dateChange?: string;
}) {
  const saved = (id: string) =>
    favorites.some((f) => f.match.contractor.id === id);
  return (
    <section
      className={`results-pane inline-results ${layout}-results`}
      aria-label={
        layout === "favorites" ? "Избранные анкеты" : "Результаты подбора"
      }
    >
      <div className="results-scroll">
        {layout === "favorites" ? (
          <>
            <div className="results-heading">
              <div>
                <p className="eyebrow">ВАШ КОРОТКИЙ СПИСОК</p>
                <h2>Хочется запомнить</h2>
              </div>
            </div>
            <p className="results-caption">
              Сохранено в этом браузере. Это ваши отметки, не отзывы и не
              бронирования. Доступность относится к дате сохранённого запроса.
            </p>
            {favorites.length ? (
              <div className="cards-grid">
                {favorites.map((f, i) => (
                  <div key={f.match.contractor.id} className="favorite-item">
                    <p className="favorite-context">
                      {dateLabel(f.query.date)} · {f.query.event_format} ·{" "}
                      {f.query.city}
                    </p>
                    <ContractorCard
                      match={f.match}
                      explanation={f.explanation}
                      index={i}
                      saved
                      onToggleFavorite={() =>
                        onToggleFavorite(f.match, f.query, f.explanation)
                      }
                    />
                    <button
                      className="text-button recheck-button"
                      disabled={busy}
                      onClick={() => onSearch(f.query)}
                    >
                      Повторить подбор на эту дату <ArrowRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pane-empty">
                <Heart size={30} />
                <h3>Здесь будет ваше избранное</h3>
                <p>
                  Нажмите сердечко на карточке. Она останется здесь даже после
                  перезагрузки страницы.
                </p>
                <button className="button secondary" onClick={onEdit}>
                  К подбору
                </button>
              </div>
            )}
          </>
        ) : result ? (
          <>
            <div className="results-heading">
              <div>
                <p className="eyebrow">ВЫБРАНО ИЗ КАТАЛОГА</p>
                <h2>
                  {result.result.status === "matched"
                    ? selectionTitle(result.result.matches.length)
                    : "Найдём другой подход"}
                </h2>
              </div>
              <span className="result-timing">
                <Check size={13} />
                {(result.elapsedMs / 1000).toFixed(2)} с
              </span>
            </div>
            <div className="result-summary">
              <span>
                {result.query.category} · {result.query.city} ·{" "}
                {dateLabel(result.query.date)} · до{" "}
                {money(result.query.budget_kzt)}
              </span>
            </div>
            {changed && (
              <div className="result-change-slot">
                <span className="changed-badge">
                  Параметры изменены — подтвердите новый подбор
                </span>
              </div>
            )}
            {dateChange && (
              <p className="info-note">
                <CalendarDays size={16} />
                {dateChange}
              </p>
            )}
            {result.notice && <p className="info-note">{result.notice}</p>}
            {result.result.status === "matched" ? (
              <>
                <p className="results-caption">
                  {result.result.totalEligible < 3
                    ? " Других, проходящих все условия, нет."
                    : " "}{" "}
                  Все изображения — AI-иллюстрации.
                </p>
                <div className="cards-grid">
                  {result.result.matches.map((match, i) => (
                    <ContractorCard
                      key={match.contractor.id}
                      match={match}
                      explanation={result.explanations[match.contractor.id]}
                      index={i}
                      saved={saved(match.contractor.id)}
                      onToggleFavorite={() =>
                        onToggleFavorite(
                          match,
                          result.query,
                          result.explanations[match.contractor.id],
                        )
                      }
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="pane-empty">
                <Sparkles size={30} />
                <h3>
                  {result.result.status === "no_category"
                    ? "Такой категории в городе нет"
                    : "Никто не проходит все условия"}
                </h3>
                <p>
                  {result.result.status === "no_category"
                    ? `В городе «${result.query.city}» пока нет анкет категории «${result.query.category}». Попробуйте изменить город или категорию.`
                    : `В городе есть ${result.result.candidatesInCity} анкет этой категории, но выбранные ограничения исключают их все. Причины — ниже.`}
                </p>
                <button className="button secondary" onClick={onEdit}>
                  Изменить условия <ArrowUp size={14} />
                </button>
              </div>
            )}
            {result.result.status !== "no_category" && (
              <details className="rejection-details">
                <summary>Почему другие анкеты не подошли</summary>
                <div>
                  {Object.entries(result.result.rejected)
                    .filter(([, n]) => n > 0)
                    .map(([key, n]) => (
                      <span key={key}>
                        {n} — {reasons[key as keyof typeof reasons]}
                      </span>
                    ))}
                </div>
                {result.availability.busyCandidates.length > 0 && (
                  <p className="busy-identities">
                    На {dateLabel(result.query.date)} заняты:{" "}
                    {result.availability.busyCandidates
                      .map((c) => c.name)
                      .join(", ")}
                    .
                  </p>
                )}
                <p>
                  У одной анкеты может быть несколько причин. Занятые на
                  выбранную дату исключаются всегда.
                </p>
              </details>
            )}
            {result.alternatives.length > 0 && (
              <div className="alternatives">
                <div>
                  <span className="assistant-symbol">
                    <Sparkles size={18} />
                  </span>
                  <h3>Можно посмотреть иначе</h3>
                  <p>
                    Меняется только одно условие. Остальные ограничения
                    сохранены и проверены.
                  </p>
                </div>
                <div className="alternative-options">
                  {result.alternatives.map((alt) => (
                    <button
                      key={alt.kind}
                      disabled={busy}
                      onClick={() => onSearch(alt.query)}
                    >
                      {alt.kind === "date" ? (
                        <CalendarDays size={17} />
                      ) : (
                        <Wallet size={17} />
                      )}
                      <span>
                        <strong>{alt.label}</strong>
                        <small>Применить и подобрать заново</small>
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="pane-empty">
            <Sparkles size={30} />
            <h3>До трёх точных совпадений</h3>
            <p>
              Расскажите о событии в чате. Здесь появятся карточки с
              объяснением, почему они подходят именно вам.
            </p>
            <button className="button secondary" onClick={onEdit}>
              К выбору условий
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
