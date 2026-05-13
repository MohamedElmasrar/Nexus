"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface SidebarContextValue {
  isCollapsed: boolean;
  isChatOpen: boolean;
  toggle: () => void;
  toggleChat: () => void;
  activeConversationId: number | null;
  setActiveConversationId: (id: number | null) => void;
  openConversation: (id: number) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  isCollapsed: false,
  isChatOpen: true,
  toggle: () => {},
  toggleChat: () => {},
  activeConversationId: null,
  setActiveConversationId: () => {},
  openConversation: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);

  const toggle = useCallback(() => setIsCollapsed((v) => !v), []);
  const toggleChat = useCallback(() => setIsChatOpen((v) => !v), []);

  const openConversation = useCallback((id: number) => {
    setActiveConversationId(id);
    setIsChatOpen(true);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        isChatOpen,
        toggle,
        toggleChat,
        activeConversationId,
        setActiveConversationId,
        openConversation,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
