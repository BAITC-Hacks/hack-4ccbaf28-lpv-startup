import { z } from "zod";
import { querySchema } from "@/domain/schema";
import { runAgent } from "@/server/agent";
import { checkRequest } from "@/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const blocked = checkRequest(request);
  if (blocked) return blocked;
  try {
    const { message, query, history, useAI } = z
      .object({
        message: z.string().trim().min(1).max(1800),
        query: querySchema,
        useAI: z.boolean().default(true),
        history: z
          .array(
            z
              .object({
                role: z.enum(["user", "assistant"]),
                content: z.string().max(1800),
              })
              .strict(),
          )
          .max(4)
          .default([]),
      })
      .strict()
      .parse(await request.json());
    return Response.json(await runAgent(message, query, history, useAI));
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        {
          error:
            "Не удалось однозначно заполнить поля. Проверьте дату (23.09–31.12.2026), бюджет и уточните запрос.",
        },
        { status: 400 },
      );
    return Response.json(
      {
        error:
          "Не удалось разобрать текст через AI. Попробуйте ещё раз или используйте форму.",
      },
      { status: 503 },
    );
  }
}
