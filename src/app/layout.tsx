import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
export const metadata: Metadata = {
  title: "LPV Match — AI-режим подбора",
  description:
    "AI-режим для каталога event-подрядчиков: до трёх рекомендаций с проверяемыми объяснениями. Прототип LPV Startup для задачи Firebird.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
