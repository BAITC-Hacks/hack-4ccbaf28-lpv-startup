"use client";
import Image from "next/image";
import { useRef } from "react";
import {
  ArrowUpRight,
  Check,
  Clock3,
  Globe2,
  MapPin,
  X,
  Heart,
} from "lucide-react";
import type { Contractor, RankedMatch } from "@/domain/types";
import { money } from "@/domain/matching";

function illustration(c: Contractor): { src: string; alt: string } {
  const category = c.categories.join(" ");
  if (/Флорист|Декоратор|Подарки/i.test(category))
    return {
      src: "/demo/florist.png",
      alt: "Демоиллюстрация цветочного оформления, созданная AI",
    };
  if (/зал|площадка|Ресторан|Отель/i.test(category))
    return {
      src: "/demo/venue.png",
      alt: "Демоиллюстрация пространства для событий, созданная AI",
    };
  if (/Фото|Видео/i.test(category))
    return {
      src: "/demo/photographer.png",
      alt: "Вымышленный образ фотографа, созданный AI",
    };
  if (/ансамбль|бэнд|Инструменталист|коллектив|Шоу/i.test(category))
    return {
      src: "/demo/music.png",
      alt: "Демоиллюстрация музыкального выступления, созданная AI",
    };
  const image =
    c.id === "HK-44923"
      ? "host-woman"
      : c.id === "HK-44733"
        ? "host-woman-2"
        : "host-man";
  return {
    src: `/demo/${image}.png`,
    alt: "Вымышленный образ ведущего, созданный AI; не фотография подрядчика",
  };
}

export default function ContractorCard({
  match,
  explanation,
  index,
  saved = false,
  onToggleFavorite,
}: {
  match: RankedMatch;
  explanation: string;
  index: number;
  saved?: boolean;
  onToggleFavorite?: () => void;
}) {
  const c = match.contractor;
  const photo = illustration(c);
  const portrait = /\/host-|\/photographer/.test(photo.src);
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <article className={`contractor-card ${portrait ? "portrait-card" : ""}`}>
      <div className="card-image">
        <div className="photo-frame">
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            sizes={
              portrait
                ? "240px"
                : "(max-width: 700px) 100vw, (max-width: 1000px) 50vw, 33vw"
            }
            style={{ objectFit: "cover" }}
            loading="lazy"
          />
        </div>
        <span className="photo-label">AI-иллюстрация</span>
        {onToggleFavorite ? (
          <button
            type="button"
            className={`favorite-button ${saved ? "saved" : ""}`}
            aria-label={`${saved ? "Убрать из избранного" : "В избранное"}: ${c.anon_name}`}
            aria-pressed={saved}
            onClick={onToggleFavorite}
          >
            <Heart size={17} fill={saved ? "currentColor" : "none"} />
          </button>
        ) : (
          <span className="card-position">0{index + 1}</span>
        )}
      </div>
      <div className="card-content">
        <div className="card-category">{c.categories.join(" · ")}</div>
        <div className="card-title">
          <h3>{c.anon_name}</h3>
          <span
            className="match-check"
            title="Проходит все обязательные фильтры"
          >
            <Check size={17} />
          </span>
        </div>
        <p className="card-location">
          <MapPin size={13} />
          {c.city}
          {c.synthetic && (
            <span className="mini-badge">синтетическая анкета</span>
          )}
        </p>
        <div className="card-price">
          <span>
            от <strong>{money(c.price_from_kzt)}</strong>
          </span>
          <small>начальная цена</small>
        </div>
        <div className="card-facts">
          <span>
            <Globe2 size={13} />
            {c.languages.join(", ")}
          </span>
          <span>
            <Clock3 size={13} />
            {c.max_hours ? `до ${c.max_hours} ч` : "без лимита часов"}
          </span>
        </div>
        <p className="card-explanation">{explanation}</p>
        <button
          type="button"
          className="card-button"
          onClick={() => dialog.current?.showModal()}
        >
          Почему подходит и анкета <ArrowUpRight size={17} />
        </button>
      </div>
      <dialog
        className="profile-dialog"
        ref={dialog}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="dialog-title">
          <div>
            <span className="eyebrow">
              {c.id} · {c.categories.join(" / ")}
            </span>
            <h2>{c.anon_name}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Закрыть анкету"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p className="subtle">
          Имя анонимизировано. Изображение — иллюстрация интерфейса, а не
          внешность этого подрядчика.
        </p>
        <h3>Почему подходит</h3>
        <ul className="evidence-list">
          {match.evidence.map((e) => (
            <li key={e.criterion}>
              <Check size={15} />
              {e.fact}
            </li>
          ))}
        </ul>
        <h3>Резюме из каталога</h3>
        <p className="full-description">{c.description}</p>
        <div className="profile-facts">
          <p>
            <b>Форматы:</b> {c.event_formats.join(", ")}
          </p>
          <p>
            <b>Языки:</b> {c.languages.join(", ")}
          </p>
          <p>
            <b>Источник:</b>{" "}
            {c.synthetic
              ? "синтетическая анкета организаторов"
              : "анонимизированная анкета организаторов"}
          </p>
          {(c.city_imputed || c.price_imputed) && (
            <p>
              Организаторы дополнили {c.city_imputed ? "город" : ""}
              {c.city_imputed && c.price_imputed ? " и " : ""}
              {c.price_imputed ? "начальную цену" : ""}.
            </p>
          )}
        </div>
        <p className="source-note">
          Контакты, соцсети и проверенные отзывы в исходном каталоге не
          предоставлены. Иллюстрации не участвуют в подборе.
        </p>
      </dialog>
    </article>
  );
}
