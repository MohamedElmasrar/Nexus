/**
 * Next.js API proxy for Nexus backend.
 *
 * Client-side code calls /api/nexus?path=/api/v1/...
 * This route injects the JWT from the httpOnly cookie and forwards
 * the request to the FastAPI backend, avoiding CORS issues.
 */

import { NextRequest, NextResponse } from "next/server";
import { NEXUS_TOKEN_COOKIE, getApiBaseUrl } from "@/lib/api";

export async function GET(request: NextRequest) {
  return proxyRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request);
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request);
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request);
}

async function proxyRequest(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(NEXUS_TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  const baseUrl = getApiBaseUrl();
  const targetUrl = `${baseUrl}${path}`;

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    let body: BodyInit | undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("multipart/form-data")) {
        // Forward multipart form data (file uploads) as-is
        const formData = await request.formData();
        body = formData;
        // Don't set Content-Type — fetch will set it with the boundary
      } else {
        try {
          const json = await request.json();
          body = JSON.stringify(json);
          headers["Content-Type"] = "application/json";
        } catch {
          // No body or not JSON — that's fine
        }
      }
    }

    const backendRes = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });

    const contentType = backendRes.headers.get("content-type");
    if (contentType && !contentType.includes("application/json")) {
      const headers: Record<string, string> = {
        "Content-Type": contentType,
      };
      const disposition = backendRes.headers.get("content-disposition");
      if (disposition && !disposition.toLowerCase().includes("attachment")) {
        headers["Content-Disposition"] = disposition;
      }
      return new NextResponse(backendRes.body, {
        status: backendRes.status,
        headers,
      });
    }

    const data = await backendRes.json().catch(() => null);

    return NextResponse.json(data, { status: backendRes.status });
  } catch {
    return NextResponse.json(
      { error: "Failed to connect to Nexus API" },
      { status: 502 }
    );
  }
}
