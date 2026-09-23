import { z } from "zod";
import { querySchema } from "@/domain/schema";
import { runSearch } from "@/server/search-service";
import { checkRequest } from "@/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const blocked = checkRequest(request);
  if (blocked) return blocked;
  try {
    const { query, useAI } = z
      .object({ query: querySchema, useAI: z.boolean().default(true) })
      .strict()
      .parse(await request.json());
    return Response.json(await runSearch(query, useAI));
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        {
          error:
            "Проверьте параметры: " +
            error.issues
              .map((i) => i.path.join(".") + " — " + i.message)
              .join("; "),
        },
        { status: 400 },
      );
    return Response.json(
      { error: "Не удалось обработать запрос. Проверьте поля и повторите." },
      { status: 400 },
    );
  }
}
