"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { ChatSidebar } from "@/components/Chat/ChatSidebar";
import { useSidebar } from "@/components/Providers/SidebarProvider";
import { Loader2, Menu, MessageCircle } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, isLoggedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { setIsMobileOpen } = useSidebar();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoading, isLoggedIn, router]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  const isChatRoute = pathname.startsWith("/dashboard/chat");

  return (
    <div className="flex h-full w-full overflow-hidden relative">
      <Sidebar />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Open navigation"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold tracking-tight text-foreground">Nexus</span>
          <div className="w-9 h-9" /> {/* Spacer to center the title */}
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          {children}
        </main>
      </div>

      <ChatSidebar />

      {/* Floating Chat Icon (redirects to /dashboard/chat, hidden when on chat page) */}
      {!isChatRoute && (
        <Link
          href="/dashboard/chat"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg hover:bg-brand/90 hover:shadow-xl transition-all duration-200 md:hidden"
          title="Open AI Chat"
        >
          <MessageCircle size={24} />
        </Link>
      )}
    </div>
  );
}
