"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useAuthSession } from "@/app/_hooks/use-auth-session";
import { submitCorrection } from "@/lib/api/corrections";
import { extractKoreanTextFromImage } from "@/lib/api/ocr";
import type {
  CorrectionInput,
  CorrectionResponse,
} from "@/lib/contracts/correction";

type FormStatus = "idle" | "loading";

export function useCorrectionWorkspace() {
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

  return {
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
  };
}
