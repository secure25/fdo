import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"], display: "swap" });

export function generateMetadata(): Metadata {
  return {
    title: {
      default: "Founder Distribution OS — You built the product. Now find the people who need it.",
      template: "%s · Founder Distribution OS",
    },
    description:
      "An AI-powered distribution operating system that discovers your customers, identifies buying signals, recommends where to engage, and learns which channels actually generate revenue.",
    icons: {
      icon: "/icon.jpg",
      apple: "/apple-icon.jpg",
    },
    other: {
      ...Sentry.getTraceData(),
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#fcfbfa",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
