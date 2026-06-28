import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/providers/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "WordSprint",
  description: "考研英语词汇练习、测试、复习和错题巩固。",
  applicationName: "WordSprint",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "WordSprint",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#071633",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
