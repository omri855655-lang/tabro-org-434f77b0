import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ConversationEntry {
  id: string;
  date: string;
  preview: string;
  messages: Message[];
}

/**
 * Persists Tabro AI chat history in Supabase (dashboard_chat_history table).
 * Current conversation: key "tabro-ai"
 * Archived conversations: key "tabro-ai-archive"
 */
export function useTabroAiHistory() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from DB on mount
  useEffect(() => {
    if (!user) {
      // Fallback to localStorage for unauthenticated
      try {
        const raw = localStorage.getItem("tabro-ai-history");
        if (raw) setMessages(JSON.parse(raw));
        const convRaw = localStorage.getItem("tabro-ai-conversations");
        if (convRaw) setConversationHistory(JSON.parse(convRaw));
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
          .eq("dashboard_key", "tabro-ai")
          .maybeSingle(),
        supabase
          .from("dashboard_chat_history")
          .select("messages")
          .eq("user_id", user.id)
          .eq("dashboard_key", "tabro-ai-archive")
          .maybeSingle(),
      ]);

      if (currentRes.data?.messages) {
        setMessages(currentRes.data.messages as unknown as Message[]);
      }
      if (archiveRes.data?.messages) {
        setConversationHistory(archiveRes.data.messages as unknown as ConversationEntry[]);
      }
      setLoaded(true);
    };
    load();
  }, [user]);

  // Save current messages to DB
  useEffect(() => {
    if (!loaded) return;

    if (!user) {
      if (messages.length > 0) {
        localStorage.setItem("tabro-ai-history", JSON.stringify(messages.slice(-50)));
      } else {
        localStorage.removeItem("tabro-ai-history");
      }
      return;
    }

    if (messages.length === 0) {
      // Delete the row when cleared
      supabase
        .from("dashboard_chat_history")
        .delete()
        .eq("user_id", user.id)
        .eq("dashboard_key", "tabro-ai")
        .then(() => {});
      return;
    }

    supabase
      .from("dashboard_chat_history")
      .upsert(
        { user_id: user.id, dashboard_key: "tabro-ai", messages: messages.slice(-50) as any },
        { onConflict: "user_id,dashboard_key" }
      )
      .then(() => {});
  }, [messages, loaded, user]);

  // Save conversation archive to DB
  useEffect(() => {
    if (!loaded) return;

    if (!user) {
      localStorage.setItem("tabro-ai-conversations", JSON.stringify(conversationHistory.slice(-30)));
      return;
    }

    if (conversationHistory.length === 0) return;

    supabase
      .from("dashboard_chat_history")
      .upsert(
        { user_id: user.id, dashboard_key: "tabro-ai-archive", messages: conversationHistory.slice(-30) as any },
        { onConflict: "user_id,dashboard_key" }
      )
      .then(() => {});
  }, [conversationHistory, loaded, user]);

  const clearAndArchive = useCallback(() => {
    if (messages.length === 0) return;
    const firstUserMsg = messages.find(m => m.role === "user");
    const entry: ConversationEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString("he-IL"),
      preview: firstUserMsg?.content.slice(0, 60) || "שיחה",
      messages: [...messages],
    };
    setConversationHistory(prev => [entry, ...prev].slice(0, 30));
    setMessages([]);
  }, [messages]);

  const loadConversation = useCallback((entry: ConversationEntry) => {
    setMessages(entry.messages);
  }, []);

  return {
    messages,
    setMessages,
    conversationHistory,
    clearAndArchive,
    loadConversation,
    loaded,
  };
}
