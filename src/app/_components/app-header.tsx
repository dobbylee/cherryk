"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GoogleIcon, LogoMark } from "@/app/_components/icons";
import type { AuthUser } from "@/lib/contracts/auth";

const navigationItems = [
  { href: "/", label: "Home" },
  { href: "/correction", label: "Correction" },
  { href: "/quizzes", label: "Practice" },
] as const;

export function AppHeader({
  authBusy,
  loginUnavailable = false,
  onLogin,
  onLogout,
  user,
}: {
  authBusy: boolean;
  loginUnavailable?: boolean;
  onLogin?: () => void;
  onLogout?: () => void;
  user: AuthUser | null;
}) {
  const pathname = usePathname();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const displayName = user?.displayName || "Learner";
  const profileInitial =
    Array.from(displayName.trim())[0]?.toUpperCase() ?? "L";

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
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-b border-[var(--line)] pb-4 sm:flex sm:min-h-14 sm:gap-6">
      <Link
        aria-label="CherryK home"
        className="inline-flex min-w-0 items-center gap-2.5 justify-self-start"
        href="/"
      >
        <LogoMark className="h-9 w-9 shrink-0" />
        <span className="text-xl font-bold tracking-[-0.035em] text-[var(--foreground)]">
          CherryK
        </span>
      </Link>

      {user ? (
        <nav
          aria-label="Primary navigation"
          className="order-3 col-span-2 flex min-w-0 items-center gap-1 overflow-x-auto rounded-xl bg-[var(--background-strong)] p-1 sm:order-none sm:col-auto sm:mr-auto sm:bg-transparent sm:p-0"
        >
          {navigationItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold sm:flex-none ${
                  isActive
                    ? "bg-white text-[var(--accent-strong)] shadow-sm sm:bg-[var(--accent-soft)] sm:shadow-none"
                    : "text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)] sm:hover:bg-[var(--panel-soft)]"
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : (
        <span
          className="justify-self-end sm:ml-auto"
          title={
            loginUnavailable ? "Sign-in is temporarily unavailable." : undefined
          }
        >
          <button
            aria-label={
              loginUnavailable
                ? "Sign in is temporarily unavailable"
                : "Sign in with Google"
            }
            className="button-secondary px-3.5"
            disabled={authBusy || loginUnavailable}
            onClick={onLogin}
            type="button"
          >
            <GoogleIcon className="h-5 w-5 rounded-full bg-white p-0.5" />
            Sign in
          </button>
        </span>
      )}

      {user && onLogout ? (
        <div className="relative justify-self-end" ref={userMenuRef}>
          <button
            aria-controls="user-menu"
            aria-expanded={isUserMenuOpen}
            aria-label={`${displayName} account menu`}
            className="inline-flex min-h-11 min-w-0 max-w-48 items-center gap-2 rounded-xl border border-[var(--line)] bg-white py-1.5 pr-2.5 pl-1.5 text-sm font-semibold text-[var(--foreground)] shadow-sm hover:border-[var(--line-strong)] hover:bg-[var(--panel-soft)] disabled:opacity-60"
            disabled={authBusy}
            onClick={() => setIsUserMenuOpen((isOpen) => !isOpen)}
            type="button"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-bold text-white"
            >
              {profileInitial}
            </span>
            <span className="hidden truncate min-[390px]:block">
              {displayName}
            </span>
            <svg
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 text-[var(--muted)] transition-transform ${
                isUserMenuOpen ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 16 16"
            >
              <path
                d="m4 6 4 4 4-4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
          </button>
          {isUserMenuOpen ? (
            <div
              className="absolute top-full right-0 z-20 mt-2 w-44 rounded-xl border border-[var(--line)] bg-white p-1.5 shadow-[var(--shadow-md)]"
              id="user-menu"
            >
              <div className="border-b border-[var(--line)] px-3 py-2 sm:hidden">
                <p className="truncate text-xs font-semibold text-[var(--muted)]">
                  {displayName}
                </p>
              </div>
              <button
                className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onLogout();
                }}
                type="button"
              >
                Log out
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
