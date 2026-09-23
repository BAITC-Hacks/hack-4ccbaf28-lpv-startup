import { z } from "zod";
import { briefSchema } from "@/domain/brief";
import { updateBrief } from "@/server/brief-agent";
import { checkRequest } from "@/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const blocked = checkRequest(request);
  if (blocked) return blocked;
  try {
    const body = z
      .object({
        message: z.string().trim().min(1).max(1800),
        brief: briefSchema,
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
    return Response.json(
      await updateBrief(body.message, body.brief, body.history),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? "Не удалось однозначно заполнить заявку. Уточните дату и бюджет или поправьте поля вручную."
            : "AI сейчас не ответил. Текст сохранён; попробуйте ещё раз или заполните форму.",
      },
      { status: error instanceof z.ZodError ? 400 : 503 },
    );
  }
}
