import { checkRequest } from "@/server/http";
import { MAX_AUDIO_BYTES, transcribe, validAudio } from "@/server/transcribe";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const blocked = checkRequest(request, MAX_AUDIO_BYTES + 65536);
  if (blocked) return blocked;
  try {
    // Enforce the limit even for requests without a Content-Length header.
    const reader = request.body?.getReader();
    if (!reader)
      return Response.json(
        { error: "Аудиозапись не получена" },
        { status: 400 },
      );
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_AUDIO_BYTES + 65536) {
        await reader.cancel();
        return Response.json(
          { error: "Запись больше 8 МБ. Запишите короткое сообщение." },
          { status: 413 },
        );
      }
      chunks.push(new Uint8Array(value));
    }
    const form = await new Response(new Blob(chunks), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || !validAudio(file))
      return Response.json(
        {
          error: "Нужна аудиозапись до 8 МБ в формате WebM, MP4, MP3 или WAV.",
        },
        { status: 400 },
      );
    return Response.json(await transcribe(file));
  } catch {
    return Response.json(
      {
        error:
          "Не удалось распознать запись. Повторите короткую фразу или напишите её в чате.",
      },
      { status: 503 },
    );
  }
}
