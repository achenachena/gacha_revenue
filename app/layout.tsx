import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: origin,
    title: "二游流水观察｜Gacha Revenue Tracker",
    description: "A bilingual mobile revenue dashboard using public Sensor Tower aggregation and automated hourly Apple grossing-rank observations.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "二游流水观察｜Gacha Revenue Tracker",
      description: "六款二游的移动端公开源流水、上下半卡池、iOS 畅销榜与七条应用线逐小时观测。",
      type: "website",
      images: [{ url: socialImage, width: 1729, height: 910, alt: "二游流水观察：公开移动端流水与 iOS 榜单观测" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "二游流水观察｜Gacha Revenue Tracker",
      description: "六款二游的移动端公开源流水、上下半卡池、iOS 畅销榜与七条应用线逐小时观测。",
      images: [socialImage],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F5F5F1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
