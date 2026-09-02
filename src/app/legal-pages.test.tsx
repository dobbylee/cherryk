import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "@/app/_components/site-footer";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";

describe("legal pages and footer", () => {
  it("links every page to the public legal notices", () => {
    const markup = renderToStaticMarkup(<SiteFooter />);

    expect(markup).toContain('href="/privacy"');
    expect(markup).toContain('href="/terms"');
    expect(markup).toContain("© 2026 CherryK");
    expect(markup).toContain('aria-label="Legal"');
  });

  it("describes the implemented account, OCR, AI, analytics, and retention boundaries", () => {
    const markup = renderToStaticMarkup(<PrivacyPage />);

    expect(markup).toContain("Google account identifier");
    expect(markup).toContain("does not persist the original image");
    expect(markup).toContain("NAVER Cloud CLOVA OCR");
    expect(markup).toContain("Korea region");
    expect(markup).toContain("Oracle Corporation · Chuncheon, South Korea");
    expect(markup).toContain("Nginx and OCI security access metadata");
    expect(markup).toContain('href="mailto:privacy_kr_grp@oracle.com"');
    expect(markup).toContain("OpenAI OpCo, LLC · United States");
    expect(markup).toContain("store: false");
    expect(markup).toContain("abuse-monitoring logs for up to 30 days");
    expect(markup).toContain("Vercel Inc. · United States");
    expect(markup).toContain("request content such as correction text");
    expect(markup).toContain("retained for no more than 30 days");
    expect(markup).toContain("discarded after 24 hours");
    expect(markup).toContain("PostgreSQL database");
    expect(markup).toContain("Root-only PostgreSQL logical backups");
    expect(markup).toContain("OCI PostgreSQL storage is required");
    expect(markup).toContain("90 days after the last activity");
    expect(markup).toContain("completes a valid request within 30 days");
    expect(markup).toContain('href="mailto:leekw1245@gmail.com"');
  });

  it("states the service rules and generated-output limitations", () => {
    const markup = renderToStaticMarkup(<TermsPage />);

    expect(markup).toContain("Terms of Service");
    expect(markup).toContain("AI and OCR limitations");
    expect(markup).toContain('href="/privacy"');
    expect(markup).toContain('href="mailto:leekw1245@gmail.com"');
  });
});
