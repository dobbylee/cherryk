"use client";

import { AppHeader } from "@/app/_components/app-header";
import { ArrowRightIcon, CameraIcon, SparkIcon } from "@/app/_components/icons";
import { SessionUnavailable } from "@/app/_components/session-unavailable";
import { CorrectionResultPanel } from "./_components/correction-result-panel";
import { useCorrectionWorkspace } from "./_hooks/use-correction-workspace";

export default function CorrectionPage() {
  const {
    authMessage,
    refreshAuth,
    authStatus,
    user,
    text,
    setText,
    inputSource,
    correction,
    correctionStatus,
    ocrStatus,
    ocrNote,
    selectedImageName,
    hasCopiedCorrection,
    message,
    ocrInputRef,
    resultRef,
    handleLogout,
    handleCorrection,
    handleOCRUpload,
    handleCopyCorrectedText,
  } = useCorrectionWorkspace();

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

        <div className="pt-1">
          <div className="min-w-0">
            <p className="section-eyebrow">Correction studio</p>
            <h1 className="page-title mt-2">Make your Korean clearer</h1>
            <p className="page-description mt-3 max-w-2xl">
              Write directly or extract a handwriting draft. You can review and
              edit everything before asking for a correction.
            </p>
          </div>
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
          <CorrectionResultPanel
            correction={correction}
            copied={hasCopiedCorrection}
            onCopy={handleCopyCorrectedText}
            resultRef={resultRef}
          />
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
