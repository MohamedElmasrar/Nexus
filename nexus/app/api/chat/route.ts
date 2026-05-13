/**
 * Nexus AI Chat — proxies to the backend chat endpoints.
 *
 * This route handles the /api/chat endpoint used by the frontend
 * chat interface, forwarding requests to the FastAPI backend.
 */

import { NextRequest, NextResponse } from "next/server";
import { NEXUS_TOKEN_COOKIE, getApiBaseUrl } from "@/lib/api";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(NEXUS_TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json(
      { answer: "Not authenticated. Please log in.", sources: [] },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const message = String(body.message ?? "").trim();
    const conversationId = body.conversation_id;

    if (!message) {
      return NextResponse.json(
        { answer: "Please ask a question so I can help you.", sources: [] },
        { status: 400 }
      );
    }

    const baseUrl = getApiBaseUrl();

    // If no conversation ID provided, create one first
    let convId = conversationId;
    if (!convId) {
      const createRes = await fetch(`${baseUrl}/api/v1/chat/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: "New conversation" }),
        cache: "no-store",
      });

      if (!createRes.ok) {
        return NextResponse.json(
          { answer: "Failed to create conversation.", sources: [] },
          { status: 500 }
        );
      }

      const convData = await createRes.json();
      convId = convData.id;
    }

    // Ask the question
    const askRes = await fetch(
      `${baseUrl}/api/v1/chat/conversations/${convId}/ask`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
        cache: "no-store",
      }
    );

    if (!askRes.ok) {
      const errData = await askRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          answer: errData.detail || "An error occurred processing your request.",
          sources: [],
        },
        { status: askRes.status }
      );
    }

    const data = await askRes.json();
    return NextResponse.json({
      answer: data.answer,
      sources: data.sources || [],
      conversation_id: data.conversation_id,
      message_id: data.message_id,
    });
  } catch {
    return NextResponse.json(
      { answer: "An error occurred processing your request.", sources: [] },
      { status: 500 }
    );
  }
}
