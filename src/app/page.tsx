"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { fetchCurrentUser, loginWithInvite, logout } from "@/lib/api/auth";
import { submitCorrection } from "@/lib/api/corrections";
import { extractKoreanTextFromImage } from "@/lib/api/ocr";
import type { AuthUser } from "@/lib/contracts/auth";
import type {
  CorrectionResponse,
  CorrectionInput,
} from "@/lib/contracts/correction";
import type { UserLevel } from "@/lib/contracts/common";

type FormStatus = "idle" | "loading";

const levelOptions: { value: UserLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "lower_intermediate", label: "Lower intermediate" },
  { value: "intermediate", label: "Intermediate" },
];

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [text, setText] = useState("저는 학교에 공부했어요.");
  const [inputSource, setInputSource] =
    useState<CorrectionInput["inputType"]>("text");
  const [level, setLevel] = useState<UserLevel>("beginner");
  const [correction, setCorrection] = useState<CorrectionResponse | null>(null);
  const [authStatus, setAuthStatus] = useState<FormStatus>("loading");
  const [correctionStatus, setCorrectionStatus] = useState<FormStatus>("idle");
  const [ocrStatus, setOcrStatus] = useState<FormStatus>("idle");
  const [ocrNote, setOcrNote] = useState<string | null>(null);
  const [ocrExtractedText, setOcrExtractedText] = useState<string | null>(null);
  const [hasCopiedCorrection, setHasCopiedCorrection] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const correctionRequestIdRef = useRef(0);

  useEffect(() => {
    activeUserIdRef.current = user?.id ?? null;
  }, [user]);

  useEffect(() => {
    let ignore = false;

    async function loadUser() {
      try {
        const response = await fetchCurrentUser();
        if (!ignore) {
          setUser(response.user);
        }
      } catch {
        if (!ignore) {
          setUser(null);
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
  }, []);

  const recommendedTags = useMemo(
    () => correction?.recommendedTags ?? [],
    [correction],
  );

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setAuthStatus("loading");
    const trimmedInviteCode = inviteCode.trim();
    const trimmedDisplayName = displayName.trim();

    try {
      const response = await loginWithInvite({
        inviteCode: trimmedInviteCode,
        displayName: trimmedDisplayName || undefined,
      });
      correctionRequestIdRef.current += 1;
      activeUserIdRef.current = response.user.id;
      setUser(response.user);
      setCorrection(null);
      setHasCopiedCorrection(false);
      setCorrectionStatus("idle");
      setOcrStatus("idle");
      setOcrNote(null);
      setOcrExtractedText(null);
      setInputSource("text");
      setInviteCode("");
      setDisplayName("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setAuthStatus("idle");
    }
  }

  async function handleLogout() {
    setMessage(null);
    setAuthStatus("loading");
    correctionRequestIdRef.current += 1;
    activeUserIdRef.current = null;
    setCorrectionStatus("idle");
    setOcrStatus("idle");
    setOcrNote(null);
    setOcrExtractedText(null);
    setInputSource("text");

    try {
      await logout();
      setUser(null);
      setCorrection(null);
      setHasCopiedCorrection(false);
    } catch (error) {
      activeUserIdRef.current = user?.id ?? null;
      setMessage(error instanceof Error ? error.message : "Logout failed.");
    } finally {
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
    const userIdAtSubmit = user.id;

    const payload: CorrectionInput = {
      text,
      inputType: inputSource,
      extractedText:
        inputSource === "image_ocr"
          ? (ocrExtractedText ?? undefined)
          : undefined,
      level,
      correctionStyle: "minimal",
    };

    try {
      const response = await submitCorrection(payload);
      if (
        correctionRequestIdRef.current === requestId &&
        activeUserIdRef.current === userIdAtSubmit
      ) {
        setCorrection(response);
        setHasCopiedCorrection(false);
      }
    } catch (error) {
      if (
        correctionRequestIdRef.current === requestId &&
        activeUserIdRef.current === userIdAtSubmit
      ) {
        setMessage(
          error instanceof Error ? error.message : "Correction failed.",
        );
      }
    } finally {
      if (
        correctionRequestIdRef.current === requestId &&
        activeUserIdRef.current === userIdAtSubmit
      ) {
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

    setMessage(null);
    setOcrStatus("loading");
    setCorrectionStatus("idle");
    const requestId = correctionRequestIdRef.current + 1;
    correctionRequestIdRef.current = requestId;
    const userIdAtSubmit = user.id;

    try {
      const response = await extractKoreanTextFromImage(image);
      if (
        correctionRequestIdRef.current === requestId &&
        activeUserIdRef.current === userIdAtSubmit
      ) {
        setText(response.extractedText);
        setInputSource("image_ocr");
        setOcrNote(response.note ?? null);
        setOcrExtractedText(response.extractedText);
        setCorrection(null);
        setHasCopiedCorrection(false);
      }
    } catch (error) {
      if (
        correctionRequestIdRef.current === requestId &&
        activeUserIdRef.current === userIdAtSubmit
      ) {
        setMessage(error instanceof Error ? error.message : "OCR failed.");
      }
    } finally {
      if (
        correctionRequestIdRef.current === requestId &&
        activeUserIdRef.current === userIdAtSubmit
      ) {
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--secondary)]">
            Invite-only MVP
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">
            Korean Correction Coach
          </h1>
        </div>
        {user ? (
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <p className="min-w-0 text-sm text-[var(--muted)]">
              {user.displayName || "Friend"} · {formatLevel(user.level)}
            </p>
            <button
              className="h-10 rounded-md border border-[var(--line)] px-4 text-sm font-semibold"
              disabled={authStatus === "loading"}
              onClick={handleLogout}
              type="button"
            >
              Logout
            </button>
          </div>
        ) : null}
      </header>

      {message ? (
        <div
          className="rounded-md border border-[var(--danger-line)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]"
          role="status"
        >
          {message}
        </div>
      ) : null}

      {!user ? (
        <section className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
          <form className="grid gap-3" onSubmit={handleLogin}>
            <div>
              <label className="text-sm font-semibold" htmlFor="invite-code">
                Invite code
              </label>
              <input
                autoComplete="off"
                className="mt-2 h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-base outline-none focus:border-[var(--accent)]"
                id="invite-code"
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="friend-dev-code"
                value={inviteCode}
              />
            </div>
            <div>
              <label className="text-sm font-semibold" htmlFor="display-name">
                Display name
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-base outline-none focus:border-[var(--accent)]"
                id="display-name"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Friend"
                value={displayName}
              />
            </div>
            <button
              className="h-11 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={authStatus === "loading" || !inviteCode.trim()}
              type="submit"
            >
              {authStatus === "loading" ? "Checking..." : "Login"}
            </button>
          </form>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form
            className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm"
            onSubmit={handleCorrection}
          >
            <div className="mb-4 rounded-md border border-dashed border-[var(--line)] bg-white p-3">
              <label className="text-sm font-semibold" htmlFor="ocr-image">
                Handwriting image
              </label>
              <input
                accept="image/*"
                className="mt-2 block w-full text-sm text-[var(--muted)] file:mr-3 file:h-10 file:rounded-md file:border file:border-[var(--line)] file:bg-white file:px-3 file:text-sm file:font-semibold file:text-[var(--foreground)] disabled:opacity-60"
                disabled={
                  authStatus === "loading" ||
                  correctionStatus === "loading" ||
                  ocrStatus === "loading"
                }
                id="ocr-image"
                onChange={handleOCRUpload}
                type="file"
              />
              {ocrStatus === "loading" || ocrNote ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {ocrStatus === "loading" ? "Extracting text..." : ocrNote}
                </p>
              ) : null}
            </div>
            <label className="text-sm font-semibold" htmlFor="korean-text">
              Write Korean
            </label>
            <textarea
              className="mt-3 min-h-44 w-full resize-y rounded-md border border-[var(--line)] bg-white p-3 text-base leading-7 outline-none focus:border-[var(--accent)]"
              id="korean-text"
              onChange={(event) => setText(event.target.value)}
              value={text}
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <select
                className="h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm"
                onChange={(event) => setLevel(event.target.value as UserLevel)}
                value={level}
              >
                {levelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                className="h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
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
          </form>

          <aside className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Practice Queue</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {recommendedTags.length ? (
                recommendedTags.map((tag) => (
                  <span
                    className="rounded-md border border-[var(--line)] px-2 py-1 text-xs text-[var(--muted)]"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-sm text-[var(--muted)]">
                  No practice tags yet
                </span>
              )}
            </div>
            <button
              className="mt-4 h-10 w-full rounded-md border border-[var(--line)] text-sm font-semibold disabled:text-[var(--muted)]"
              disabled
              type="button"
            >
              Practice MCQ
            </button>
          </aside>
        </section>
      )}

      {user && correction ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Correction Result</h2>
              <button
                className="h-9 rounded-md border border-[var(--line)] px-3 text-sm font-semibold"
                onClick={handleCopyCorrectedText}
                type="button"
              >
                {hasCopiedCorrection ? "Copied" : "Copy text"}
              </button>
            </div>
            <dl className="mt-4 grid gap-4 text-sm">
              <ResultBlock label="Original" value={correction.originalText} />
              <ResultBlock label="Corrected" value={correction.correctedText} />
              <ResultBlock
                label="More natural"
                value={correction.naturalText}
              />
              <ResultBlock
                label="Explanation"
                value={correction.explanationEn}
              />
            </dl>
          </article>

          <article className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Mistakes</h2>
            <div className="mt-3 grid gap-3">
              {correction.mistakes.map((mistake, index) => (
                <div
                  className="rounded-md border border-[var(--line)] p-3"
                  key={`${mistake.tag}-${index}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[var(--tag-bg)] px-2 py-1 text-xs font-semibold text-[var(--secondary)]">
                      {mistake.tag}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {mistake.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">
                    {mistake.originalPart} → {mistake.correctedPart}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {mistake.explanationEn}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}

function ResultBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold">{label}</dt>
      <dd className="mt-1 leading-6 text-[var(--muted)]">{value}</dd>
    </div>
  );
}

function formatLevel(level: UserLevel) {
  return levelOptions.find((option) => option.value === level)?.label ?? level;
}
