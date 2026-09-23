import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
export const metadata: Metadata = {
  title: "LPV Match — люди для вашего события",
  description:
    "Подбор подрядчиков с объяснениями по каталогу Firebird. Дата, бюджет и ваши пожелания — в одном месте.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
