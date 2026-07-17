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
import { fetchCurrentUser, logout } from "@/lib/api/auth";
import { submitCorrection } from "@/lib/api/corrections";
import { extractKoreanTextFromImage } from "@/lib/api/ocr";
import { buildCorrectionHighlightSegments } from "@/lib/correctionHighlights";
import type { AuthUser } from "@/lib/contracts/auth";
import type {
  CorrectionInput,
  CorrectionResponse,
} from "@/lib/contracts/correction";

type FormStatus = "idle" | "loading";

export default function CorrectionPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [text, setText] = useState("저는 학교에 공부했어요.");
  const [inputSource, setInputSource] =
    useState<CorrectionInput["inputType"]>("text");
  const [correction, setCorrection] = useState<CorrectionResponse | null>(null);
  const [authStatus, setAuthStatus] = useState<FormStatus>("loading");
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
    let ignore = false;

    async function loadUser() {
      try {
        const response = await fetchCurrentUser();
        if (ignore) {
          return;
        }
        if (!response.user) {
          router.replace("/");
          return;
        }
        setUser(response.user);
      } catch {
        if (!ignore) {
          router.replace("/");
        }
      } finally {
        if (!ignore) {
          setAuthStatus("idle");
        }
      }
    }

    void loadUser();

    return () => {
      ignore = true;
    };
  }, [router]);

  useEffect(() => {
    if (correction) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [correction]);

  async function handleLogout() {
    setMessage(null);
    setAuthStatus("loading");
    correctionRequestIdRef.current += 1;
    setCorrectionStatus("idle");
    setOcrStatus("idle");

    try {
      await logout();
      router.replace("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Logout failed.");
      setAuthStatus("idle");
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
    return <LoadingPage />;
  }

  const uploadBusy =
    authStatus === "loading" ||
    correctionStatus === "loading" ||
    ocrStatus === "loading";

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <AppHeader
          authBusy={authStatus === "loading"}
          onLogout={handleLogout}
          user={user}
        />

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[var(--accent)]">Correction</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal">
              Write or confirm OCR text
            </h2>
          </div>
          <Link
            className="text-sm font-semibold text-[var(--accent-strong)]"
            href="/"
          >
            All tools
          </Link>
        </div>

        {message ? <ErrorMessage message={message} /> : null}

        <form
          className="border border-[var(--line)] bg-[var(--panel)] shadow-[0_18px_44px_rgb(32_143_202_/_7%)]"
          onSubmit={handleCorrection}
        >
          <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-[var(--accent)]">
              Correction workspace
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                {inputSource === "image_ocr" ? "OCR input" : "Text input"}
              </span>
            </div>
          </div>

          <div className="grid gap-4 p-4">
            <div className="border-b border-dashed border-[var(--line)] pb-4">
              <span className="text-sm font-semibold">Handwriting image</span>
              <input
                accept="image/*"
                aria-label="Choose handwriting image"
                className="hidden"
                disabled={uploadBusy}
                id="ocr-image"
                onChange={handleOCRUpload}
                ref={ocrInputRef}
                type="file"
              />
              <div className="mt-2 flex min-w-0 items-center gap-3">
                <button
                  className="h-10 shrink-0 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
                  disabled={uploadBusy}
                  onClick={() => ocrInputRef.current?.click()}
                  type="button"
                >
                  Choose image
                </button>
                <span className="min-w-0 truncate text-sm text-[var(--muted)]">
                  {selectedImageName ?? "No image selected"}
                </span>
              </div>
              {ocrStatus === "loading" || ocrNote ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {ocrStatus === "loading" ? "Extracting text..." : ocrNote}
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-semibold" htmlFor="korean-text">
                Korean text
              </label>
              <textarea
                className="mt-3 min-h-52 w-full resize-y rounded-md border border-[var(--line)] bg-white p-4 text-lg leading-8 outline-none focus:border-[var(--accent)]"
                id="korean-text"
                onChange={(event) => setText(event.target.value)}
                value={text}
              />
            </div>

            <div className="flex justify-end">
              <button
                className="h-11 rounded-md border border-[var(--accent)] bg-white px-5 text-sm font-semibold text-[var(--accent-strong)] shadow-[inset_0_0_0_1px_rgb(255_255_255_/_75%)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
                disabled={
                  authStatus === "loading" ||
                  correctionStatus === "loading" ||
                  ocrStatus === "loading" ||
                  !text.trim()
                }
                type="submit"
              >
                {correctionStatus === "loading" ? "Correcting..." : "Correct"}
              </button>
            </div>
          </div>
        </form>

        {correction ? (
          <section className="scroll-mt-4 grid gap-4" ref={resultRef}>
            <article className="border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_18px_44px_rgb(32_143_202_/_7%)]">
              <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-[var(--accent)]">
                    Result
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-normal">
                    Correction result
                  </h2>
                </div>
                <button
                  className="h-10 rounded-md border border-[var(--accent)] bg-white px-4 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent-soft)]"
                  onClick={handleCopyCorrectedText}
                  type="button"
                >
                  {hasCopiedCorrection ? "Copied" : "Copy text"}
                </button>
              </div>
              <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
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

            <article className="border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_18px_44px_rgb(32_143_202_/_7%)]">
              <div className="border-b border-[var(--line)] pb-4">
                <p className="text-sm font-bold text-[var(--accent)]">
                  Review notes
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-normal">
                  Mistakes
                </h2>
              </div>
              <div className="mt-4 grid gap-3">
                {correction.mistakes.map((mistake, index) => (
                  <div
                    className="border-l-2 border-[var(--line)] pl-3"
                    key={`${mistake.tag}-${index}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[var(--line)] bg-white px-2 py-1 text-xs font-semibold text-[var(--secondary)]">
                        {mistake.tag}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
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
                <div className="flex flex-wrap gap-2">
                  {correction.recommendedTags.map((tag) => (
                    <span
                      className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--secondary)]"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  className="mt-4 flex h-11 items-center justify-center rounded-md border border-[var(--accent)] bg-white px-4 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent-soft)]"
                  href={{
                    pathname: "/quizzes",
                    query: correction.recommendedTags.length
                      ? { tags: correction.recommendedTags.join(",") }
                      : undefined,
                  }}
                >
                  Practice related MCQ
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
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <p className="text-sm text-[var(--muted)]" role="status">
          Checking session...
        </p>
      </div>
    </main>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      className="rounded-md border border-[var(--danger-line)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]"
      role="status"
    >
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
    <div className="border-t border-[var(--line)] pt-3">
      <dt className="font-semibold">{label}</dt>
      <dd
        className={`mt-2 leading-7 ${
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
