import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { contractorSchema } from "../src/domain/schema";

const source = readFileSync("data/contractors.csv");
const rows = parse(source, {
  columns: true,
  bom: true,
  skip_empty_lines: true,
}) as Record<string, string>[];
const list = (value: string) =>
  value
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
const bool = (value: string) => {
  if (!/^(true|false)$/i.test(value))
    throw new Error(`Invalid boolean: ${value}`);
  return value.toLowerCase() === "true";
};
const catalog = rows.map((row) =>
  contractorSchema.parse({
    ...row,
    categories: list(row.categories),
    event_formats: list(row.event_formats),
    languages: list(row.languages),
    busy_dates: list(row.busy_dates),
    price_from_kzt: Number(row.price_from_kzt),
    max_hours: row.max_hours.trim() === "" ? null : Number(row.max_hours),
    synthetic: bool(row.synthetic),
    city_imputed: bool(row.city_imputed),
    price_imputed: bool(row.price_imputed),
  }),
);
if (catalog.length !== 66 || new Set(catalog.map((c) => c.id)).size !== 66)
  throw new Error("Expected 66 unique official profiles");
writeFileSync("data/contractors.json", JSON.stringify(catalog, null, 2) + "\n");
console.log(
  `Validated ${catalog.length} profiles; source SHA-256 ${createHash("sha256").update(source).digest("hex")}`,
);
