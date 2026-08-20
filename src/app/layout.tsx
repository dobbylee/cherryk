import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SiteFooter } from "@/app/_components/site-footer";
import "./globals.css";

const siteTitle = "CherryK — Learn Korean with clarity";
const siteDescription =
  "Turn Korean writing and handwriting into clear corrections and reviewed practice.";

export const metadata: Metadata = {
  metadataBase: new URL("https://cherryk.kr"),
  applicationName: "CherryK",
  title: {
    default: siteTitle,
    template: "%s · CherryK",
  },
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    siteName: "CherryK",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  icons: {
    icon: [
      { url: "/brand/icons/favicon.ico", type: "image/x-icon" },
      {
        url: "/brand/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/brand/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/brand/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: ["/brand/icons/favicon.ico"],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="site-frame">
          {children}
          <SiteFooter />
        </div>
        <Analytics />
      </body>
    </html>
  );
}
