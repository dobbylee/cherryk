import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CherryK — Learn Korean with clarity",
    template: "%s · CherryK",
  },
  description:
    "Turn Korean writing and handwriting into clear corrections and reviewed practice.",
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
        {children}
        <Analytics />
      </body>
    </html>
  );
}
