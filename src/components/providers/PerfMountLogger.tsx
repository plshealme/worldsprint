"use client";

import { useEffect } from "react";
import { perfLog } from "@/lib/perfLog";

export function PerfMountLogger({ name }: { name: string }) {
  useEffect(() => {
    perfLog(`${name} mounted`);
  }, [name]);

  return null;
}
