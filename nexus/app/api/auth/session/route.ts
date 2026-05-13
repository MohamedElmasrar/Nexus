import { NextRequest, NextResponse } from "next/server";
import { NEXUS_TOKEN_COOKIE, getApiBaseUrl } from "@/lib/api";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(NEXUS_TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  // Validate token by calling the Nexus /users/me/ endpoint
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/users/me/`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const user = await res.json();
    return NextResponse.json({ authenticated: true, user });
  } catch {
    return NextResponse.json({ authenticated: false, user: null });
  }
}