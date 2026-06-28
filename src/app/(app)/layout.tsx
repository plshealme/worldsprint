import { AppShell } from "@/components/layout/AppShell";
import { AppStateProvider } from "@/components/providers/AppStateProvider";
import { PwaRegister } from "@/components/providers/PwaRegister";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppStateProvider>
      <PwaRegister />
      <AppShell>{children}</AppShell>
    </AppStateProvider>
  );
}
