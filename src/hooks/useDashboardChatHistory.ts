import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ChatMessage {
  role: string;
  content: string;
}

interface ArchivedConversation {
  id: string;
  date: string;
  preview: string;
  messages: ChatMessage[];
}

/**
 * Persists AI chat history per dashboard type in Supabase.
 * Supports conversation archiving (clear = archive, not delete).
 */
export function useDashboardChatHistory(dashboardKey: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [archive, setArchive] = useState<ArchivedConversation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const storageKey = `dashboard-chat-${dashboardKey}`;
  const archiveKey = `${dashboardKey}-archive`;

  // Load from DB on mount
  useEffect(() => {
    if (!user) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) setMessages(JSON.parse(raw));
        const archiveRaw = localStorage.getItem(`dashboard-chat-${archiveKey}`);
        if (archiveRaw) setArchive(JSON.parse(archiveRaw));
      } catch {}
      setLoaded(true);
      return;
    }

    const load = async () => {
      const [currentRes, archiveRes] = await Promise.all([
        supabase
          .from("dashboard_chat_history")
          .select("messages")
          .eq("user_id", user.id)
          .eq("dashboard_key", dashboardKey)
          .maybeSingle(),
        supabase
          .from("dashboard_chat_history")
          .select("messages")
          .eq("user_id", user.id)
          .eq("dashboard_key", archiveKey)
          .maybeSingle(),
      ]);

      if (currentRes.data?.messages) {
        setMessages(currentRes.data.messages as unknown as ChatMessage[]);
      }
      if (archiveRes.data?.messages) {
        setArchive(archiveRes.data.messages as unknown as ArchivedConversation[]);
      }
      setLoaded(true);
    };
    load();
  }, [user, dashboardKey]);

  // Save messages
  useEffect(() => {
    if (!loaded) return;

    if (messages.length === 0) {
      if (!user) {
        localStorage.removeItem(storageKey);
        return;
      }
      supabase
        .from("dashboard_chat_history")
        .delete()
        .eq("user_id", user.id)
        .eq("dashboard_key", dashboardKey)
        .then(() => {});
      return;
    }

    const trimmed = messages.slice(-50);

    if (!user) {
      localStorage.setItem(storageKey, JSON.stringify(trimmed));
      return;
    }

    supabase
      .from("dashboard_chat_history")
      .upsert(
        { user_id: user.id, dashboard_key: dashboardKey, messages: trimmed as any },
        { onConflict: "user_id,dashboard_key" }
      )
      .then(() => {});
  }, [messages, loaded, user, dashboardKey, storageKey]);

  // Save archive
  useEffect(() => {
    if (!loaded) return;

    if (!user) {
      localStorage.setItem(`dashboard-chat-${archiveKey}`, JSON.stringify(archive.slice(-30)));
      return;
    }

    if (archive.length === 0) return;

    supabase
      .from("dashboard_chat_history")
      .upsert(
        { user_id: user.id, dashboard_key: archiveKey, messages: archive.slice(-30) as any },
        { onConflict: "user_id,dashboard_key" }
      )
      .then(() => {});
  }, [archive, loaded, user, archiveKey]);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  /** Archive current conversation and clear messages */
  const clearAndArchive = useCallback(() => {
    if (messages.length === 0) return;
    const firstUserMsg = messages.find(m => m.role === "user");
    const entry: ArchivedConversation = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString("he-IL"),
      preview: firstUserMsg?.content.slice(0, 60) || "שיחה",
      messages: [...messages],
    };
    setArchive(prev => [entry, ...prev].slice(0, 30));
    setMessages([]);
  }, [messages]);

  /** Load a conversation from archive */
  const loadConversation = useCallback((entry: ArchivedConversation) => {
    setMessages(entry.messages);
  }, []);

  /** Hard delete (no archive) */
  const clearHistory = useCallback(async () => {
    setMessages([]);
    if (user) {
      await supabase
        .from("dashboard_chat_history")
        .delete()
        .eq("user_id", user.id)
        .eq("dashboard_key", dashboardKey);
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [user, dashboardKey, storageKey]);

  return {
    messages,
    setMessages,
    addMessage,
    clearHistory,
    clearAndArchive,
    archive,
    loadConversation,
    loaded,
  };
}
