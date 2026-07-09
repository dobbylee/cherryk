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
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-[var(--foreground)] sm:text-3xl">
              CherryK
            </h1>
          </div>
          {user ? (
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <p className="min-w-0 text-sm font-medium text-[var(--muted)]">
                {user.displayName || "Friend"} / {formatLevel(user.level)}
              </p>
              <button
                className="h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] disabled:opacity-60"
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
          <section className="grid pt-3 pb-6 sm:pt-4">
            <div className="grid gap-5 border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_18px_44px_rgb(32_143_202_/_8%)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
              <div className="border-b border-[var(--line)] pb-5 lg:border-r lg:border-b-0 lg:pr-6 lg:pb-0">
                <p className="text-sm font-bold text-[var(--accent)]">
                  Correction / OCR / Practice
                </p>
                <h2 className="mt-3 max-w-xl text-3xl leading-tight font-semibold tracking-normal sm:text-4xl">
                  One workspace for Korean writing correction.
                </h2>
                <div className="mt-5 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-3">
                  <span className="border-t border-[var(--line)] pt-3">
                    Direct text
                  </span>
                  <span className="border-t border-[var(--line)] pt-3">
                    OCR review
                  </span>
                  <span className="border-t border-[var(--line)] pt-3">
                    Copy corrected text
                  </span>
                </div>
              </div>
              <form className="grid gap-3" onSubmit={handleLogin}>
                <div>
                  <label
                    className="text-sm font-semibold"
                    htmlFor="invite-code"
                  >
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
                  <label
                    className="text-sm font-semibold"
                    htmlFor="display-name"
                  >
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
                  className="h-11 rounded-md border border-[var(--accent)] bg-white px-4 text-sm font-semibold text-[var(--accent-strong)] shadow-[inset_0_0_0_1px_rgb(255_255_255_/_75%)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
                  disabled={authStatus === "loading" || !inviteCode.trim()}
                  type="submit"
                >
                  {authStatus === "loading" ? "Checking..." : "Login"}
                </button>
              </form>
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <form
                className="border border-[var(--line)] bg-[var(--panel)] shadow-[0_18px_44px_rgb(32_143_202_/_7%)]"
                onSubmit={handleCorrection}
              >
                <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-[var(--accent)]">
                      Correction workspace
                    </p>
                    <h2 className="mt-1 text-xl font-semibold tracking-normal">
                      Write or confirm OCR text
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                      {inputSource === "image_ocr" ? "OCR input" : "Text input"}
                    </span>
                    <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                      {formatLevel(level)}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 p-4">
                  <div className="border-b border-dashed border-[var(--line)] pb-4">
                    <label
                      className="text-sm font-semibold"
                      htmlFor="ocr-image"
                    >
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
                        {ocrStatus === "loading"
                          ? "Extracting text..."
                          : ocrNote}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      className="text-sm font-semibold"
                      htmlFor="korean-text"
                    >
                      Korean text
                    </label>
                    <textarea
                      className="mt-3 min-h-52 w-full resize-y rounded-md border border-[var(--line)] bg-white p-4 text-lg leading-8 outline-none focus:border-[var(--accent)]"
                      id="korean-text"
                      onChange={(event) => setText(event.target.value)}
                      value={text}
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <select
                      className="h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)]"
                      onChange={(event) =>
                        setLevel(event.target.value as UserLevel)
                      }
                      value={level}
                    >
                      {levelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
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
                      {correctionStatus === "loading"
                        ? "Correcting..."
                        : "Correct"}
                    </button>
                  </div>
                </div>
              </form>

              <aside className="border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_18px_44px_rgb(32_143_202_/_7%)]">
                <div className="border-b border-[var(--line)] pb-4">
                  <p className="text-sm font-bold text-[var(--accent)]">
                    Practice queue
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-normal">
                    Recommended tags
                  </h2>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {recommendedTags.length ? (
                    recommendedTags.map((tag) => (
                      <span
                        className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--secondary)]"
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
                  className="mt-4 h-10 w-full rounded-md border border-[var(--line)] bg-white text-sm font-semibold text-[var(--muted)]"
                  disabled
                  type="button"
                >
                  Practice MCQ
                </button>
                <div className="mt-5 border-t border-[var(--line)] pt-4">
                  <p className="text-sm font-bold text-[var(--accent)]">
                    Review lane
                  </p>
                  <div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
                    <span className="border-l-2 border-[var(--line)] pl-3">
                      AI draft
                    </span>
                    <span className="border-l-2 border-[var(--line)] pl-3">
                      Native review
                    </span>
                    <span className="border-l-2 border-[var(--line)] pl-3">
                      Approved quiz
                    </span>
                  </div>
                </div>
              </aside>
            </section>

            {correction ? (
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <article className="border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_18px_44px_rgb(32_143_202_/_7%)]">
                  <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-[var(--accent)]">
                        Split proof
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
                    <ResultBlock
                      label="Original"
                      value={correction.originalText}
                    />
                    <ResultBlock
                      label="Corrected"
                      tone="accent"
                      value={correction.correctedText}
                    />
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
                </article>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function ResultBlock({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent";
}) {
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
        {value}
      </dd>
    </div>
  );
}

function formatLevel(level: UserLevel) {
  return levelOptions.find((option) => option.value === level)?.label ?? level;
}
