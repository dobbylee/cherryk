"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCurrentUser, login, logout } from "@/lib/api/auth";
import { resolveAuthSession } from "@/lib/authSession";
import type { AuthUser } from "@/lib/contracts/auth";
import { invalidateLatestRequest, runLatestRequest } from "@/lib/latestRequest";

type AuthSessionState = {
  status: "loading" | "authenticated" | "signed-out" | "unavailable";
  user: AuthUser | null;
  message: string | null;
};

const initialState: AuthSessionState = {
  status: "loading",
  user: null,
  message: null,
};

export function useAuthSession() {
  const [session, setSession] = useState(initialState);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    setSession((current) => ({
      ...current,
      status: "loading",
      message: null,
    }));
    const result = await runLatestRequest(requestRef, () =>
      resolveAuthSession(fetchCurrentUser),
    );
    if (result.status !== "success") {
      return;
    }

    const resolved = result.value;
    setSession({
      status: resolved.status,
      user: resolved.user,
      message: resolved.status === "unavailable" ? resolved.message : null,
    });
  }, []);

  useEffect(() => {
    void refresh();
    return () => invalidateLatestRequest(requestRef);
  }, [refresh]);

  const signIn = useCallback(async () => {
    invalidateLatestRequest(requestRef);
    setSession((current) => ({
      ...current,
      status: "loading",
      message: null,
    }));
    try {
      login();
    } catch (error) {
      setSession((current) => ({
        ...current,
        status: "unavailable",
        message: error instanceof Error ? error.message : "Sign-in failed.",
      }));
    }
  }, []);

  const signOut = useCallback(async () => {
    setSession((current) => ({
      ...current,
      status: "loading",
      message: null,
    }));
    const result = await runLatestRequest(requestRef, logout);
    if (result.status === "success") {
      setSession({
        status: "signed-out",
        user: null,
        message: null,
      });
      return true;
    }
    if (result.status === "error") {
      setSession((current) => ({
        ...current,
        status: "unavailable",
        message:
          result.error instanceof Error
            ? result.error.message
            : "Logout failed.",
      }));
    }
    return false;
  }, []);

  return {
    ...session,
    refresh,
    signIn,
    signOut,
  };
}
