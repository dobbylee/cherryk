"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "@/lib/contracts/auth";

export function AppHeader({
  authBusy,
  onLogout,
  user,
}: {
  authBusy: boolean;
  onLogout: () => void;
  user: AuthUser | null;
}) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const displayName = user?.displayName || "Friend";
  const profileInitial =
    Array.from(displayName.trim())[0]?.toUpperCase() ?? "F";

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !userMenuRef.current?.contains(event.target)
      ) {
        setIsUserMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUserMenuOpen]);

  return (
    <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
      <Link href="/">
        <h1 className="text-2xl font-semibold tracking-normal text-[var(--foreground)] sm:text-3xl">
          CherryK
        </h1>
      </Link>
      {user ? (
        <div className="relative flex justify-end" ref={userMenuRef}>
          <button
            aria-controls="user-menu"
            aria-expanded={isUserMenuOpen}
            className="inline-flex h-10 max-w-64 items-center gap-2 rounded-full border border-[var(--line)] bg-white py-1 pr-3 pl-1.5 text-base font-semibold text-[var(--foreground)] shadow-sm hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
            disabled={authBusy}
            onClick={() => setIsUserMenuOpen((isOpen) => !isOpen)}
            type="button"
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white"
            >
              {profileInitial}
            </span>
            <span className="truncate">{displayName}</span>
          </button>
          {isUserMenuOpen ? (
            <div
              className="absolute top-full right-0 z-20 mt-2 w-32 rounded-md border border-[var(--line)] bg-white p-1 shadow-[0_12px_30px_rgb(25_75_100_/_16%)]"
              id="user-menu"
            >
              <button
                className="flex h-9 w-full items-center rounded px-3 text-left text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onLogout();
                }}
                type="button"
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
