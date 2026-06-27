import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { AppStateProvider } from "@/components/providers/AppStateProvider";
import { PwaRegister } from "@/components/providers/PwaRegister";

export const metadata: Metadata = {
  title: "WordSprint",
  description: "Learn it fast. Make it last.",
  applicationName: "WordSprint",
  appleWebApp: {
    capable: true,
    title: "WordSprint",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <AppStateProvider>
          <PwaRegister />
          <AppShell>{children}</AppShell>
        </AppStateProvider>
      </body>
    </html>
  );
}
