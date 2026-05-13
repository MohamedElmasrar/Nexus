import { NextResponse } from "next/server";
import { NEXUS_TOKEN_COOKIE } from "@/lib/api";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(NEXUS_TOKEN_COOKIE, "", {
    path: "/",
    maxAge: 0,
  });

  return response;
}