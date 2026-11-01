// The briefing logic lives in supabase/functions/_shared so the scheduled email
// function and this app preview always produce the same content.
export * from "../../supabase/functions/_shared/dailyBriefing.ts";
