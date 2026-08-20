import Link from "next/link";

const footerLinks = [
  { href: { pathname: "/privacy" }, label: "Privacy" },
  { href: { pathname: "/terms" }, label: "Terms" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pt-4 pb-6 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:pb-8">
      <p>© 2026 CherryK</p>
      <nav aria-label="Legal">
        <ul className="flex items-center gap-5">
          {footerLinks.map((link) => (
            <li key={link.href.pathname}>
              <Link
                className="font-semibold hover:text-[var(--accent-strong)]"
                href={link.href}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}
