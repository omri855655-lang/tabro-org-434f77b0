import { useState, useEffect, useCallback } from "react";

const STORAGE_PREFIX = "dashboard-chat-";

interface ChatMessage {
  role: string;
  content: string;
}

/**
 * Persists AI chat history per dashboard type in localStorage.
 * Restores on mount and saves after each message.
 */
export function useDashboardChatHistory(dashboardKey: string) {
  const storageKey = STORAGE_PREFIX + dashboardKey;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return { messages, setMessages, addMessage, clearHistory };
}
