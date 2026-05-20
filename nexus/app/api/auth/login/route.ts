import { NextRequest, NextResponse } from "next/server";
import { NEXUS_TOKEN_COOKIE, getApiBaseUrl } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    // Nexus API expects OAuth2 form data
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    const baseUrl = getApiBaseUrl();
    const nexusRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: formData.toString(),
      cache: "no-store",
    });

    if (!nexusRes.ok) {
      return NextResponse.json(
        { error: "Invalid credentials or server unreachable." },
        { status: 401 }
      );
    }

    const tokenResponse = await nexusRes.json();
    const accessToken = tokenResponse.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Server did not return an authentication token." },
        { status: 502 }
      );
    }

    const response = NextResponse.json({ success: true });
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const isHttps = forwardedProto === "https" || request.nextUrl.protocol === "https:";
    response.cookies.set(NEXUS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Unexpected error while signing in." },
      { status: 500 }
    );
  }
}