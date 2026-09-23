const recent: number[] = [];
export function checkRequest(
  request: Request,
  maxBytes = 16000,
): Response | null {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const source = new URL(origin);
      const host = request.headers.get("host") ?? new URL(request.url).host;
      if (
        source.host !== host ||
        !["http:", "https:"].includes(source.protocol)
      )
        return Response.json(
          { error: "Недопустимый источник запроса" },
          { status: 403 },
        );
    } catch {
      return Response.json(
        { error: "Недопустимый источник запроса" },
        { status: 403 },
      );
    }
  }
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes)
    return Response.json({ error: "Слишком большой запрос" }, { status: 413 });
  const now = Date.now();
  while (recent.length && recent[0] < now - 60_000) recent.shift();
  if (recent.length >= 30)
    return Response.json(
      { error: "Слишком много запросов. Попробуйте через минуту." },
      { status: 429 },
    );
  recent.push(now);
  return null;
}
