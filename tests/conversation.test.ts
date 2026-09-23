import { test } from "node:test";
import assert from "node:assert/strict";
import {
  conversationContext,
  selectionTitle,
  type ConversationEntry,
} from "../src/domain/conversation";
import { runSearch } from "../src/server/search-service";
import { initialQuery } from "../src/server/catalog";

test("chat result attachments never leak profiles into later brief requests", async () => {
  const selection = await runSearch(initialQuery, false);
  const messages: ConversationEntry[] = [
    { role: "assistant", content: "Привет" },
    { role: "user", content: "Нужен ведущий" },
    {
      role: "assistant",
      content: selectionTitle(selection.result.matches.length),
      selection,
      dateChange: "Причина смены даты",
    },
    { role: "user", content: "Теперь на 17 октября" },
    { role: "assistant", content: "Подтвердите дату" },
  ];
  const context = conversationContext(messages);
  assert.equal(context.length, 4);
  assert.ok(
    context.every(
      (entry) => Object.keys(entry).sort().join() === "content,role",
    ),
  );
  assert.equal(context[1].content, "Найдено 3 варианта");
  assert.equal(messages[2].selection, selection);
  assert.equal(selectionTitle(1), "Найден 1 вариант");
});
