"use client";
import { useEffect, useRef, useState } from "react";

type VoiceState = "idle" | "permission" | "recording" | "processing";
export function useVoiceRecorder(
  onAudio: (blob: Blob) => Promise<void>,
  onStart: () => void,
  onError: (message: string) => void,
) {
  const [state, setState] = useState<VoiceState>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const generation = useRef(0);
  const phase = useRef<VoiceState>("idle");
  function changeState(next: VoiceState) {
    phase.current = next;
    setState(next);
  }
  const mounted = useRef(true);
  const callbacks = useRef({ onAudio, onStart, onError });
  useEffect(() => {
    callbacks.current = { onAudio, onStart, onError };
  }, [onAudio, onStart, onError]);
  function release() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }
  function stop(cancel = false) {
    if (cancel) generation.current++;
    if (recorder.current?.state === "recording") recorder.current.stop();
    release();
    changeState(cancel ? "idle" : "processing");
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
    };
  }, []);
  async function toggle() {
    if (phase.current === "recording") {
      stop();
      return;
    }
    if (phase.current !== "idle") return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      callbacks.current.onError(
        "В этом браузере запись недоступна. Откройте сайт в Safari или Chrome через HTTPS либо localhost; пока можно написать в чате.",
      );
      return;
    }
    const session = ++generation.current;
    changeState("permission");
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (session !== generation.current || !mounted.current) {
        audio.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = audio;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("UNSUPPORTED");
      const active = new MediaRecorder(audio, {
        mimeType,
        audioBitsPerSecond: 64000,
      });
      recorder.current = active;
      const chunks: BlobPart[] = [];
      let byteCount = 0;
      active.ondataavailable = (event) => {
        if (session !== generation.current || !mounted.current) return;
        if (event.data.size) {
          chunks.push(event.data);
          byteCount += event.data.size;
        }
        if (byteCount > 8 * 1024 * 1024) {
          stop(true);
          callbacks.current.onError(
            "Запись слишком большая. Попробуйте короткое сообщение до минуты.",
          );
        }
      };
      active.onerror = () => {
        if (session !== generation.current || !mounted.current) return;
        stop(true);
        callbacks.current.onError(
          "Запись прервалась. Проверьте микрофон и попробуйте ещё раз.",
        );
      };
      active.onstop = async () => {
        if (session !== generation.current || !mounted.current) return;
        release();
        const blob = new Blob(chunks, { type: active.mimeType });
        if (!blob.size) {
          changeState("idle");
          callbacks.current.onError("Запись пустая. Попробуйте ещё раз.");
          return;
        }
        changeState("processing");
        try {
          await callbacks.current.onAudio(blob);
        } catch {
          callbacks.current.onError(
            "Не удалось отправить запись. Попробуйте ещё раз.",
          );
        } finally {
          if (mounted.current) changeState("idle");
        }
      };
      callbacks.current.onStart();
      setSeconds(0);
      active.start(1000);
      changeState("recording");
      const started = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        setSeconds(elapsed);
        if (elapsed >= 60) stop();
      }, 250);
    } catch (error) {
      if (session !== generation.current || !mounted.current) return;
      release();
      changeState("idle");
      callbacks.current.onError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Нет доступа к микрофону. Разрешите его в настройках браузера или напишите сообщение."
          : "Не удалось включить микрофон. Проверьте, что он подключён и доступен браузеру.",
      );
    }
  }
  return { state, seconds, toggle, cancel: () => stop(true) };
}
