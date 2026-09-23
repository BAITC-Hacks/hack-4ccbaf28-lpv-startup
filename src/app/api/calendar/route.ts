import { briefSchema } from "@/domain/brief";
import { availabilityCalendar } from "@/domain/calendar";
import { catalog } from "@/server/catalog";
import { checkRequest } from "@/server/http";
export async function POST(request: Request) {
  const blocked = checkRequest(request);
  if (blocked) return blocked;
  try {
    return Response.json(
      availabilityCalendar(catalog, briefSchema.parse(await request.json())),
    );
  } catch {
    return Response.json(
      { error: "Проверьте параметры календаря" },
      { status: 400 },
    );
  }
}
