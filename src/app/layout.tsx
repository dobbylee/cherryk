import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CherryK",
  description:
    "Mobile-first Korean writing correction and reviewed MCQ practice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
