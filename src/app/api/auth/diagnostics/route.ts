import { NextResponse } from "next/server";
import { supabaseAuthEnvState } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET() {
  const state = supabaseAuthEnvState();

  return NextResponse.json(
    {
      hasSupabaseUrl: state.supabaseUrlExists,
      hasSupabaseAnonKey: state.supabaseAnonKeyExists,
      hasSupabaseServiceRoleKey: state.supabaseServiceRoleKeyExists,
      nodeEnv: state.nodeEnv,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
