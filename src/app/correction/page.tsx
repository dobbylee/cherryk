"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { AppHeader } from "@/app/_components/app-header";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CameraIcon,
  CopyIcon,
  QuizIcon,
  SparkIcon,
} from "@/app/_components/icons";
import { SessionUnavailable } from "@/app/_components/session-unavailable";
import { useAuthSession } from "@/app/_hooks/use-auth-session";
import { submitCorrection } from "@/lib/api/corrections";
import { extractKoreanTextFromImage } from "@/lib/api/ocr";
import { buildCorrectionHighlightSegments } from "@/lib/correctionHighlights";
import type {
  CorrectionInput,
  CorrectionResponse,
} from "@/lib/contracts/correction";

type FormStatus = "idle" | "loading";

export default function CorrectionPage() {
  const router = useRouter();
  const {
    message: authMessage,
    refresh: refreshAuth,
    signOut,
    status: authStatus,
    user,
  } = useAuthSession();
  const [text, setText] = useState("저는 학교에 공부했어요.");
  const [inputSource, setInputSource] =
    useState<CorrectionInput["inputType"]>("text");
  const [correction, setCorrection] = useState<CorrectionResponse | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<FormStatus>("idle");
  const [ocrStatus, setOcrStatus] = useState<FormStatus>("idle");
  const [ocrNote, setOcrNote] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string | null>(
    null,
  );
  const [hasCopiedCorrection, setHasCopiedCorrection] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const correctionRequestIdRef = useRef(0);
  const ocrInputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (authStatus === "signed-out") {
      router.replace("/");
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (correction) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [correction]);

  async function handleLogout() {
    setMessage(null);
    correctionRequestIdRef.current += 1;
    setCorrectionStatus("idle");
    setOcrStatus("idle");

    if (await signOut()) {
      router.replace("/");
    }
  }

  async function handleCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || authStatus === "loading") {
      return;
    }

    setMessage(null);
    setCorrectionStatus("loading");
    const requestId = correctionRequestIdRef.current + 1;
    correctionRequestIdRef.current = requestId;

    const payload: CorrectionInput = {
      text,
      inputType: inputSource,
      level: user.level,
      correctionStyle: "minimal",
    };

    try {
      const response = await submitCorrection(payload);
      if (correctionRequestIdRef.current === requestId) {
        setCorrection(response);
        setHasCopiedCorrection(false);
      }
    } catch (error) {
      if (correctionRequestIdRef.current === requestId) {
        setMessage(
          error instanceof Error ? error.message : "Correction failed.",
        );
      }
    } finally {
      if (correctionRequestIdRef.current === requestId) {
        setCorrectionStatus("idle");
      }
    }
  }

  async function handleOCRUpload(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    event.target.value = "";

    if (!image || !user || authStatus === "loading") {
      return;
    }

    setSelectedImageName(image.name);
    setMessage(null);
    setOcrStatus("loading");
    setCorrectionStatus("idle");
    const requestId = correctionRequestIdRef.current + 1;
    correctionRequestIdRef.current = requestId;

    try {
      const response = await extractKoreanTextFromImage(image);
      if (correctionRequestIdRef.current === requestId) {
        setText(response.extractedText);
        setInputSource("image_ocr");
        setOcrNote(response.note ?? null);
        setCorrection(null);
        setHasCopiedCorrection(false);
      }
    } catch (error) {
      if (correctionRequestIdRef.current === requestId) {
        setMessage(error instanceof Error ? error.message : "OCR failed.");
      }
    } finally {
      if (correctionRequestIdRef.current === requestId) {
        setOcrStatus("idle");
      }
    }
  }

  async function handleCopyCorrectedText() {
    if (!correction) {
      return;
    }

    setMessage(null);

    try {
      await navigator.clipboard.writeText(correction.correctedText);
      setHasCopiedCorrection(true);
    } catch {
      setMessage("Copy failed.");
    }
  }

  if (!user) {
    if (authStatus === "unavailable") {
      return (
        <SessionUnavailable
          message={authMessage ?? "Authentication is unavailable."}
          onRetry={() => void refreshAuth()}
        />
      );
    }
    return <LoadingPage />;
  }

  const uploadBusy =
    authStatus === "loading" ||
    correctionStatus === "loading" ||
    ocrStatus === "loading";

  return (
    <main className="app-shell">
      <div className="app-container flex max-w-5xl flex-col gap-5 sm:gap-6">
        <AppHeader
          authBusy={authStatus === "loading"}
          onLogout={handleLogout}
          user={user}
        />

        <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="section-eyebrow">Correction studio</p>
            <h1 className="page-title mt-2">Make your Korean clearer</h1>
            <p className="page-description mt-3 max-w-2xl">
              Write directly or extract a handwriting draft. You can review and
              edit everything before asking for a correction.
            </p>
          </div>
          <Link className="button-secondary w-full shrink-0 sm:w-auto" href="/">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to home
          </Link>
        </div>

        {authMessage ? <ErrorMessage message={authMessage} /> : null}
        {message ? <ErrorMessage message={message} /> : null}

        <form
          className="surface-card-elevated overflow-hidden"
          onSubmit={handleCorrection}
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--panel-soft)] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <SparkIcon className="h-4 w-4" />
              </span>
              <p className="text-sm font-bold text-[var(--foreground)]">
                Your correction workspace
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--secondary)]">
              {inputSource === "image_ocr" ? "OCR input" : "Text input"}
            </span>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="p-5 sm:p-6 lg:p-8">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-bold" htmlFor="korean-text">
                  Korean text
                </label>
                <span
                  className="text-xs font-semibold text-[var(--muted)]"
                  id="korean-text-count"
                >
                  {text.length} / 4,000
                </span>
              </div>
              <textarea
                aria-describedby="korean-text-help korean-text-count"
                className="form-control mt-3 min-h-64 resize-y p-4 text-lg leading-8 sm:min-h-72"
                id="korean-text"
                maxLength={4000}
                onChange={(event) => setText(event.target.value)}
                placeholder="Write a Korean sentence you want to improve..."
                value={text}
              />
              <p
                className="mt-2 text-xs leading-5 text-[var(--muted)]"
                id="korean-text-help"
              >
                Your meaning stays intact. CherryK makes only the corrections
                needed for natural Korean.
              </p>
            </div>

            <aside className="border-t border-[var(--line)] bg-[var(--panel-soft)] p-5 sm:p-6 lg:border-t-0 lg:border-l">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <CameraIcon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-base font-bold">Use handwriting</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Upload a clear photo, then check the extracted draft before you
                continue.
              </p>
              <input
                accept="image/*"
                aria-label="Choose handwriting photo"
                className="hidden"
                disabled={uploadBusy}
                id="ocr-image"
                onChange={handleOCRUpload}
                ref={ocrInputRef}
                type="file"
              />
              <div className="mt-4 grid min-w-0 gap-2">
                <button
                  className="button-secondary w-full"
                  disabled={uploadBusy}
                  onClick={() => ocrInputRef.current?.click()}
                  type="button"
                >
                  <CameraIcon className="h-4 w-4" />
                  {ocrStatus === "loading"
                    ? "Reading photo..."
                    : "Choose photo"}
                </button>
                <span className="min-w-0 truncate text-xs text-[var(--muted)]">
                  {selectedImageName ?? "No image selected"}
                </span>
              </div>
              {ocrStatus === "loading" ? (
                <div
                  aria-live="polite"
                  className="status-neutral mt-3 flex items-center gap-2 font-semibold text-[var(--accent-strong)]"
                  role="status"
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent"
                  />
                  Extracting Korean text...
                </div>
              ) : ocrNote ? (
                <p className="status-neutral mt-3">{ocrNote}</p>
              ) : null}
            </aside>
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--line)] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs leading-5 text-[var(--muted)]">
              Review your input first—you can always edit the draft above.
            </p>
            <button
              className="button-primary w-full sm:w-auto sm:min-w-44"
              disabled={
                authStatus === "loading" ||
                correctionStatus === "loading" ||
                ocrStatus === "loading" ||
                !text.trim()
              }
              type="submit"
            >
              {correctionStatus === "loading" ? (
                "Correcting..."
              ) : (
                <>
                  Review correction
                  <ArrowRightIcon className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {correction ? (
          <section className="grid scroll-mt-4 gap-4" ref={resultRef}>
            <article className="surface-card-elevated p-5 sm:p-7">
              <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="section-eyebrow">Correction result</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">
                    Your revised Korean
                  </h2>
                </div>
                <button
                  className="button-secondary w-full sm:w-auto"
                  onClick={handleCopyCorrectedText}
                  type="button"
                >
                  <CopyIcon className="h-4 w-4" />
                  {hasCopiedCorrection ? "Copied" : "Copy text"}
                </button>
              </div>
              <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2">
                <ResultBlock label="Original" value={correction.originalText} />
                <ResultBlock
                  correctionChanges={correction.mistakes}
                  label="Corrected"
                  originalValue={correction.originalText}
                  tone="accent"
                  value={correction.correctedText}
                />
                <ResultBlock
                  label="Explanation"
                  value={correction.explanationEn}
                />
              </dl>
            </article>

            <article className="surface-card p-5 sm:p-7">
              <div className="border-b border-[var(--line)] pb-4">
                <p className="section-eyebrow">Review notes</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.025em]">
                  What changed and why
                </h2>
              </div>
              <div className="mt-4 grid gap-3">
                {correction.mistakes.map((mistake, index) => (
                  <div
                    className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4"
                    key={`${mistake.tag}-${index}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                        {mistake.tag}
                      </span>
                      <span className="text-xs font-semibold text-[var(--muted)]">
                        {mistake.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium">
                      {mistake.originalPart} / {mistake.correctedPart}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {mistake.explanationEn}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-[var(--line)] pt-4">
                <div className="flex items-center gap-2">
                  <QuizIcon className="h-5 w-5 text-[var(--accent)]" />
                  <p className="text-sm font-bold">Practice this lesson</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {correction.recommendedTags.map((tag) => (
                    <span
                      className="mt-3 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--secondary)]"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  className="button-primary mt-4 w-full sm:w-fit"
                  href={{
                    pathname: "/quizzes",
                    query: correction.recommendedTags.length
                      ? { tags: correction.recommendedTags.join(",") }
                      : undefined,
                  }}
                >
                  Practice related MCQ
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </article>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function LoadingPage() {
  return (
    <main className="app-shell grid min-h-screen place-items-center px-4">
      <div
        className="surface-card flex items-center gap-3 px-5 py-4"
        role="status"
      >
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent"
        />
        <p className="text-sm font-semibold text-[var(--muted)]">
          Preparing your workspace...
        </p>
      </div>
    </main>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="status-error" role="status">
      {message}
    </div>
  );
}

function ResultBlock({
  correctionChanges,
  label,
  originalValue,
  value,
  tone = "default",
}: {
  correctionChanges?: {
    originalPart: string;
    correctedPart: string;
  }[];
  label: string;
  originalValue?: string;
  value: string;
  tone?: "default" | "accent";
}) {
  const segments = correctionChanges
    ? buildCorrectionHighlightSegments(
        originalValue ?? "",
        value,
        correctionChanges,
      )
    : null;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4">
      <dt className="font-semibold">{label}</dt>
      <dd
        className={`mt-2 whitespace-pre-wrap leading-7 ${
          tone === "accent"
            ? "text-lg font-semibold text-[var(--foreground)]"
            : "text-[var(--muted)]"
        }`}
      >
        {segments
          ? segments.map((segment, index) => (
              <span
                className={
                  segment.highlighted
                    ? "font-bold text-[var(--accent-strong)]"
                    : undefined
                }
                key={`${segment.highlighted}-${index}`}
              >
                {segment.text}
              </span>
            ))
          : value}
      </dd>
    </div>
  );
}
