import { test } from "node:test";
import assert from "node:assert/strict";
import { readFavorites } from "../src/domain/favorites";
import { search } from "../src/domain/matching";
import { catalog, initialQuery } from "../src/server/catalog";
test("favorites survive serialization, reject corrupt storage, and deduplicate identities", () => {
  const match = search(catalog, initialQuery).matches[0];
  const item = {
    match,
    query: initialQuery,
    explanation: "Проверенное объяснение",
    savedAt: "2026-09-23T10:20:00.000Z",
  };
  assert.equal(readFavorites(JSON.stringify([item, item])).length, 1);
  assert.equal(
    readFavorites(
      JSON.stringify([
        { ...item, query: { ...initialQuery, date: "2028-01-01" } },
      ]),
    ).length,
    0,
  );
  assert.deepEqual(readFavorites("invalid json"), []);
  assert.deepEqual(readFavorites(null), []);
});
