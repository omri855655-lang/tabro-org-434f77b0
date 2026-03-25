import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface StopwatchState {
  accumulated_seconds: number;
  running: boolean;
  started_at: string | null;
  current_date_str: string;
}

const getTodayStr = () => {
  // Israel timezone
  const now = new Date();
  const il = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  return il.toISOString().slice(0, 10);
};

export function useDailyStopwatch() {
  const { user } = useAuth();
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accumulatedRef = useRef(0);
  const startedAtRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  // Load from DB on mount
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("daily_stopwatch")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      const today = getTodayStr();

      if (data && data.current_date_str === today) {
        accumulatedRef.current = data.accumulated_seconds;
        startedAtRef.current = data.started_at;
        setIsRunning(data.running);

        let total = data.accumulated_seconds;
        if (data.running && data.started_at) {
          total += Math.floor((Date.now() - new Date(data.started_at).getTime()) / 1000);
        }
        setStopwatchTime(total);
      } else if (data) {
        // Different day — log old session and reset
        const oldTotal = data.running && data.started_at
          ? data.accumulated_seconds + Math.floor((Date.now() - new Date(data.started_at).getTime()) / 1000)
          : data.accumulated_seconds;

        if (oldTotal > 60) {
          // Save to localStorage sessions for history
          const oldSessions = JSON.parse(localStorage.getItem("deeply-sessions") || "[]");
          oldSessions.unshift({
            id: Date.now().toString(),
            type: "stopwatch",
            duration: Math.round(oldTotal / 60),
            frequency: "none",
            timestamp: data.current_date_str + "T23:59:00",
          });
          localStorage.setItem("deeply-sessions", JSON.stringify(oldSessions));
        }

        // Reset for today
        await supabase.from("daily_stopwatch").update({
          accumulated_seconds: 0,
          running: false,
          started_at: null,
          current_date_str: today,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id);

        accumulatedRef.current = 0;
        startedAtRef.current = null;
        setIsRunning(false);
        setStopwatchTime(0);
      }
      // No row yet — will create on first start
      setLoaded(true);
    };
    load();
  }, [user]);

  // Tick
  useEffect(() => {
    if (isRunning && loaded) {
      tickRef.current = setInterval(() => {
        if (startedAtRef.current) {
          const elapsed = Math.floor((Date.now() - new Date(startedAtRef.current).getTime()) / 1000);
          setStopwatchTime(accumulatedRef.current + elapsed);
        }
      }, 1000);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [isRunning, loaded]);

  // Save to DB (debounced — every 30s while running, and on toggle)
  const saveToDb = useCallback(async (running: boolean, accumulated: number, startedAt: string | null) => {
    if (!user || savingRef.current) return;
    savingRef.current = true;
    try {
      const today = getTodayStr();
      const payload = {
        user_id: user.id,
        accumulated_seconds: accumulated,
        running,
        started_at: startedAt,
        current_date_str: today,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from("daily_stopwatch")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("daily_stopwatch").update(payload).eq("user_id", user.id);
      } else {
        await supabase.from("daily_stopwatch").insert(payload);
      }
    } finally {
      savingRef.current = false;
    }
  }, [user]);

  // Periodic save while running
  useEffect(() => {
    if (!isRunning || !loaded) return;
    const interval = setInterval(() => {
      saveToDb(true, accumulatedRef.current, startedAtRef.current);
    }, 30000);
    return () => clearInterval(interval);
  }, [isRunning, loaded, saveToDb]);

  // 3-hour reminder
  const reminderSentRef = useRef(false);
  useEffect(() => {
    if (!isRunning || !loaded) return;
    const checkReminder = () => {
      if (stopwatchTime >= 10800 && !reminderSentRef.current) {
        reminderSentRef.current = true;
        toast.info("⏱️ הסטופר פועל כבר 3 שעות! האם שכחת לכבות?", { duration: 10000 });
        // Send push notification
        if (user) {
          supabase.functions.invoke('send-push-notifications', {
            body: {
              userId: user.id,
              title: "⏱️ תזכורת סטופר",
              body: "הסטופר פועל כבר 3 שעות ברציפות. האם שכחת לכבות?",
            },
          }).catch(() => {});
        }
      }
    };
    const interval = setInterval(checkReminder, 30000);
    checkReminder();
    return () => clearInterval(interval);
  }, [isRunning, loaded, stopwatchTime, user]);

  // Reset reminder flag when stopwatch resets
  useEffect(() => {
    if (!isRunning) reminderSentRef.current = false;
  }, [isRunning]);

  // Midnight check
  useEffect(() => {
    if (!loaded) return;
    const checkMidnight = () => {
      const today = getTodayStr();
      if (startedAtRef.current) {
        const startDate = new Date(startedAtRef.current).toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }).slice(0, 10);
      }
    };
    const interval = setInterval(checkMidnight, 60000);
    return () => clearInterval(interval);
  }, [loaded]);

  const toggleStopwatch = useCallback(() => {
    if (!isRunning) {
      // Start
      const now = new Date().toISOString();
      startedAtRef.current = now;
      setIsRunning(true);
      saveToDb(true, accumulatedRef.current, now);
    } else {
      // Pause — accumulate elapsed
      if (startedAtRef.current) {
        const elapsed = Math.floor((Date.now() - new Date(startedAtRef.current).getTime()) / 1000);
        accumulatedRef.current += elapsed;
      }
      startedAtRef.current = null;
      setIsRunning(false);
      setStopwatchTime(accumulatedRef.current);
      saveToDb(false, accumulatedRef.current, null);
    }
  }, [isRunning, saveToDb]);

  const resetStopwatch = useCallback(() => {
    const currentTime = stopwatchTime;
    setIsRunning(false);
    setStopwatchTime(0);
    accumulatedRef.current = 0;
    startedAtRef.current = null;
    saveToDb(false, 0, null);
    return currentTime; // Return time for logging
  }, [stopwatchTime, saveToDb]);

  return {
    stopwatchTime,
    isStopwatchRunning: isRunning,
    toggleStopwatch,
    resetStopwatch,
    loaded,
  };
}
