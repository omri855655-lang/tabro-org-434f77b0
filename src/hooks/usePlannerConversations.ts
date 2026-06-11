import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationRecord {
  id: string;
  conversation_date: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
  tasks_snapshot: unknown[];
  source: 'remote' | 'local';
}

const STORAGE_VERSION = 'v2';

const buildStorageKey = (userId: string) => `tabro:planner-conversations:${STORAGE_VERSION}:${userId}`;

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string'
  );
};

const normalizeConversation = (
  value: unknown,
  fallbackSource: ConversationRecord['source'],
): ConversationRecord | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || typeof candidate.conversation_date !== 'string') {
    return null;
  }

  const messages = Array.isArray(candidate.messages)
    ? candidate.messages.filter(isChatMessage)
    : [];
  const tasksSnapshot = Array.isArray(candidate.tasks_snapshot) ? candidate.tasks_snapshot : [];
  const createdAt = typeof candidate.created_at === 'string' ? candidate.created_at : new Date().toISOString();
  const updatedAt = typeof candidate.updated_at === 'string' ? candidate.updated_at : createdAt;
  const source = candidate.source === 'remote' || candidate.source === 'local'
    ? candidate.source
    : fallbackSource;

  return {
    id: candidate.id,
    conversation_date: candidate.conversation_date,
    created_at: createdAt,
    updated_at: updatedAt,
    messages,
    tasks_snapshot: tasksSnapshot,
    source,
  };
};

const readStoredConversations = (userId: string): ConversationRecord[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(buildStorageKey(userId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizeConversation(item, 'local'))
      .filter((item): item is ConversationRecord => Boolean(item))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  } catch (error) {
    console.warn('Failed to read planner conversations from localStorage', error);
    return [];
  }
};

const writeStoredConversations = (userId: string, conversations: ConversationRecord[]) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(buildStorageKey(userId), JSON.stringify(conversations));
  } catch (error) {
    console.warn('Failed to persist planner conversations to localStorage', error);
  }
};

const mergeConversationLists = (
  remoteConversations: ConversationRecord[],
  localConversations: ConversationRecord[],
) => {
  const localDates = new Set(localConversations.map((conversation) => conversation.conversation_date));
  const merged = new Map<string, ConversationRecord>();

  localConversations.forEach((conversation) => {
    merged.set(conversation.id, conversation);
  });

  remoteConversations.forEach((conversation) => {
    if (localDates.has(conversation.conversation_date)) return;
    merged.set(conversation.id, conversation);
  });

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
};

const createLocalConversation = (date: string): ConversationRecord => {
  const timestamp = new Date().toISOString();

  return {
    id: `local-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    conversation_date: date,
    created_at: timestamp,
    updated_at: timestamp,
    messages: [],
    tasks_snapshot: [],
    source: 'local',
  };
};

export function usePlannerConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ConversationRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchConversations = useCallback(async () => {
    if (!user) return [];

    const localConversations = readStoredConversations(user.id);
    const { data, error } = await supabase
      .from('planner_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(30);

    const remoteConversations = !error && data
      ? data
          .map((row) => normalizeConversation({
            id: row.id,
            conversation_date: row.conversation_date,
            created_at: row.created_at,
            updated_at: row.updated_at,
            messages: row.messages,
            tasks_snapshot: row.tasks_snapshot,
            source: 'remote',
          }, 'remote'))
          .filter((item): item is ConversationRecord => Boolean(item))
      : [];

    const merged = mergeConversationLists(remoteConversations, localConversations);
    setConversations(merged);
    return merged;
  }, [user]);

  const loadTodayConversation = useCallback(async () => {
    if (!user) return null;
    setLoading(true);

    const merged = await fetchConversations();
    const todayConversation = merged.find((conversation) => conversation.conversation_date === today) || null;

    setCurrentConversation(todayConversation);
    setLoading(false);
    return todayConversation;
  }, [fetchConversations, today, user]);

  const loadConversation = useCallback(async (conversationId: string) => {
    if (!user) return null;
    setLoading(true);

    const merged = conversations.length > 0 ? conversations : await fetchConversations();
    const targetConversation = merged.find((conversation) => conversation.id === conversationId) || null;

    setCurrentConversation(targetConversation);
    setLoading(false);
    return targetConversation;
  }, [conversations, fetchConversations, user]);

  const saveConversation = useCallback(async (
    messages: ChatMessage[],
    tasksSnapshot: unknown[],
    date?: string,
  ) => {
    if (!user) return null;

    const conversationDate = date || currentConversation?.conversation_date || today;
    const timestamp = new Date().toISOString();
    const localConversations = readStoredConversations(user.id);
    const existingConversation = currentConversation
      ? localConversations.find((conversation) => conversation.id === currentConversation.id) || currentConversation
      : null;

    const nextConversation: ConversationRecord = {
      id: existingConversation?.id || createLocalConversation(conversationDate).id,
      conversation_date: conversationDate,
      created_at: existingConversation?.created_at || timestamp,
      updated_at: timestamp,
      messages,
      tasks_snapshot: tasksSnapshot,
      source: 'local',
    };

    const nextLocalConversations = [
      nextConversation,
      ...localConversations.filter((conversation) => conversation.id !== nextConversation.id),
    ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    writeStoredConversations(user.id, nextLocalConversations);
    setCurrentConversation(nextConversation);
    setConversations((previous) => mergeConversationLists(
      previous.filter((conversation) => conversation.source === 'remote'),
      nextLocalConversations,
    ));

    const { error } = await supabase
      .from('planner_conversations')
      .upsert({
        user_id: user.id,
        conversation_date: conversationDate,
        messages: messages as unknown as never[],
        tasks_snapshot: tasksSnapshot as unknown as never[],
      }, {
        onConflict: 'user_id,conversation_date',
      });

    if (error) {
      console.warn('Failed to sync planner conversation to Supabase', error);
    }

    return nextConversation;
  }, [currentConversation, today, user]);

  const startNewConversation = useCallback((date: string = today) => {
    if (!user) return null;

    const nextConversation = createLocalConversation(date);
    const localConversations = [
      nextConversation,
      ...readStoredConversations(user.id),
    ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    writeStoredConversations(user.id, localConversations);
    setCurrentConversation(nextConversation);
    setConversations((previous) => mergeConversationLists(
      previous.filter((conversation) => conversation.source === 'remote'),
      localConversations,
    ));

    return nextConversation;
  }, [today, user]);

  useEffect(() => {
    if (!user) return;
    void fetchConversations();
  }, [fetchConversations, user]);

  return {
    conversations,
    currentConversation,
    loading,
    loadTodayConversation,
    loadConversation,
    saveConversation,
    startNewConversation,
    today,
  };
}
