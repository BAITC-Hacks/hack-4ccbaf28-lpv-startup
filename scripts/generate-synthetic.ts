import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { generateSyntheticCatalog } from "./synthetic-fixtures";

const profiles = generateSyntheticCatalog();
assert.equal(profiles.length, 120);
assert.equal(new Set(profiles.map((p) => p.id)).size, 120);
assert.equal(new Set(profiles.map((p) => p.description)).size, 120);
const serialized = JSON.stringify(profiles, null, 2) + "\n";
const path = "data/contractors.synthetic.json";
if (process.argv.includes("--check")) {
  assert.equal(
    readFileSync(path, "utf8"),
    serialized,
    "Regenerate synthetic catalog to match its versioned source",
  );
  console.log(
    "PASS: 120 reproducible, distinct, explicitly synthetic team profiles",
  );
} else {
  writeFileSync(path, serialized);
  console.log("Generated 120 synthetic profiles; official catalog unchanged");
}
