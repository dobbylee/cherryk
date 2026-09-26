"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useAuthSession } from "@/app/_hooks/use-auth-session";
import { fetchQuizRecommendations, submitQuizAttempt } from "@/lib/api/quizzes";
import { GrammarTags, type GrammarTag } from "@/lib/contracts/grammar-tags";
import type {
  QuizAttemptResponse,
  QuizPracticeItem,
  QuizProgress,
  QuizType,
} from "@/lib/contracts/quiz";
import { invalidateLatestRequest, runLatestRequest } from "@/lib/latestRequest";
import { scrollQuizActionsIntoView } from "@/lib/quizScroll";

type FormStatus = "idle" | "loading";
const grammarTagSet = new Set<string>(GrammarTags);

export function useQuizPractice() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    message: authMessage,
    refresh: refreshAuth,
    signOut,
    status: authStatus,
    user,
  } = useAuthSession();
  const [quizzes, setQuizzes] = useState<QuizPracticeItem[]>([]);
  const [availableTags, setAvailableTags] = useState<GrammarTag[]>([]);
  const [activeTags, setActiveTags] = useState<GrammarTag[]>([]);
  const [progress, setProgress] = useState<QuizProgress>({
    solvedCount: 0,
    totalCount: 0,
    attemptCount: 0,
    correctCount: 0,
  });
  const [activeQuizIndex, setActiveQuizIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [quizAttempt, setQuizAttempt] = useState<QuizAttemptResponse | null>(
    null,
  );
  const [quizStatus, setQuizStatus] = useState<FormStatus>("idle");
  const [quizAttemptStatus, setQuizAttemptStatus] =
    useState<FormStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const quizRequestIdRef = useRef(0);
  const initialLoadKeyRef = useRef<string | null>(null);
  const quizActionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (authStatus === "signed-out") {
      initialLoadKeyRef.current = null;
      invalidateLatestRequest(quizRequestIdRef);
      router.replace("/");
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (quizAttempt) {
      scrollQuizActionsIntoView(quizActionsRef.current);
    }
  }, [quizAttempt]);

  const hasExplicitTags = searchParams.has("tags");
  const quizType: QuizType =
    searchParams.get("type") === "vocabulary" ? "vocabulary" : "grammar";
  const requestedTags = useMemo(() => {
    if (quizType === "vocabulary" || !hasExplicitTags) {
      return undefined;
    }

    return Array.from(
      new Set(
        (searchParams.get("tags") ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag): tag is GrammarTag => grammarTagSet.has(tag)),
      ),
    );
  }, [hasExplicitTags, quizType, searchParams]);
  const requestedTagsKey =
    `${quizType}:` +
    (requestedTags === undefined
      ? "history"
      : requestedTags.join(",") || "all");
  const selectedTags =
    quizType === "grammar" && hasExplicitTags
      ? (requestedTags ?? []).filter((tag) => availableTags.includes(tag))
      : activeTags;
  const activeQuiz = quizzes[activeQuizIndex] ?? null;
  const quizControlsBusy =
    authStatus === "loading" ||
    quizStatus === "loading" ||
    quizAttemptStatus === "loading";

  const handleLoadRecommendedQuizzes = useCallback(async () => {
    if (!user || authStatus === "loading") {
      return;
    }

    setMessage(null);
    setQuizStatus("loading");
    setQuizAttemptStatus("idle");
    setSelectedChoiceId(null);
    setQuizAttempt(null);
    const result = await runLatestRequest(quizRequestIdRef, () =>
      fetchQuizRecommendations(requestedTags, quizType),
    );

    if (result.status === "success") {
      const response = result.value;
      setQuizzes(response.quizzes);
      setAvailableTags(response.availableTags);
      setActiveTags(response.activeTags);
      setProgress(response.progress);
      setActiveQuizIndex(0);
      setSelectedChoiceId(null);
      setQuizAttempt(null);
      setMessage(response.quizzes.length ? null : "No approved quizzes yet.");
      setQuizStatus("idle");
    } else if (result.status === "error") {
      setMessage(
        result.error instanceof Error
          ? result.error.message
          : "Practice failed.",
      );
      setQuizStatus("idle");
    }
  }, [authStatus, quizType, requestedTags, user]);

  useEffect(() => {
    if (!user || authStatus === "loading") {
      return;
    }

    const loadKey = `${user.id}:${requestedTagsKey}`;
    if (initialLoadKeyRef.current === loadKey) {
      return;
    }
    initialLoadKeyRef.current = loadKey;
    void handleLoadRecommendedQuizzes();
  }, [authStatus, handleLoadRecommendedQuizzes, requestedTagsKey, user]);

  async function handleLogout() {
    setMessage(null);
    invalidateLatestRequest(quizRequestIdRef);
    setQuizStatus("idle");
    setQuizAttemptStatus("idle");

    if (await signOut()) {
      router.replace("/");
    }
  }

  async function handleQuizAttempt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !activeQuiz ||
      !selectedChoiceId ||
      authStatus === "loading" ||
      quizStatus === "loading" ||
      quizAttemptStatus === "loading"
    ) {
      return;
    }

    setMessage(null);
    setQuizAttemptStatus("loading");
    const result = await runLatestRequest(quizRequestIdRef, () =>
      submitQuizAttempt({
        quizId: activeQuiz.id,
        selectedChoiceId,
      }),
    );

    if (result.status === "success") {
      const response = result.value;
      setQuizAttempt(response);
      setProgress((currentProgress) => ({
        ...currentProgress,
        solvedCount:
          currentProgress.solvedCount + (activeQuiz.attemptCount === 0 ? 1 : 0),
        attemptCount: currentProgress.attemptCount + 1,
        correctCount:
          currentProgress.correctCount + (response.isCorrect ? 1 : 0),
      }));
      setQuizzes((currentQuizzes) =>
        currentQuizzes.map((quiz) =>
          quiz.id === activeQuiz.id
            ? { ...quiz, attemptCount: quiz.attemptCount + 1 }
            : quiz,
        ),
      );
      setQuizAttemptStatus("idle");
    } else if (result.status === "error") {
      setMessage(
        result.error instanceof Error
          ? result.error.message
          : "Quiz attempt failed.",
      );
      setQuizAttemptStatus("idle");
    }
  }

  function handleNextQuiz() {
    setActiveQuizIndex((currentIndex) =>
      Math.min(currentIndex + 1, quizzes.length - 1),
    );
    setSelectedChoiceId(null);
    setQuizAttempt(null);
    setMessage(null);
  }

  function updateTagFilter(tags: GrammarTag[] | null) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    if (tags === null) {
      nextSearchParams.delete("tags");
    } else {
      nextSearchParams.set("tags", tags.join(","));
    }

    const query = nextSearchParams.toString();
    router.replace(query ? `/quizzes?${query}` : "/quizzes", {
      scroll: false,
    });
  }

  function updateQuizType(nextQuizType: QuizType) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("tags");
    if (nextQuizType === "grammar") {
      nextSearchParams.delete("type");
    } else {
      nextSearchParams.set("type", nextQuizType);
    }

    const query = nextSearchParams.toString();
    router.replace(query ? `/quizzes?${query}` : "/quizzes", {
      scroll: false,
    });
  }

  function handleTagToggle(tag: GrammarTag) {
    const nextTags = new Set(selectedTags);

    if (nextTags.has(tag)) {
      nextTags.delete(tag);
    } else {
      nextTags.add(tag);
    }

    updateTagFilter(GrammarTags.filter((candidate) => nextTags.has(candidate)));
  }

  return {
    authMessage,
    refreshAuth,
    authStatus,
    user,
    quizzes,
    availableTags,
    activeTags,
    progress,
    activeQuizIndex,
    selectedChoiceId,
    setSelectedChoiceId,
    quizAttempt,
    quizStatus,
    quizAttemptStatus,
    message,
    quizActionsRef,
    hasExplicitTags,
    quizType,
    selectedTags,
    activeQuiz,
    quizControlsBusy,
    handleLoadRecommendedQuizzes,
    handleLogout,
    handleQuizAttempt,
    handleNextQuiz,
    updateTagFilter,
    updateQuizType,
    handleTagToggle,
  };
}
