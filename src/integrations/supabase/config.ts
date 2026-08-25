const DEFAULT_SUPABASE_PROJECT_ID = "qfcuyrdxaambvppduslo";
const DEFAULT_SUPABASE_URL = `https://${DEFAULT_SUPABASE_PROJECT_ID}.supabase.co`;
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_VUKynrohH32JCp3mygpx3g_WtJdOW25";

export const SUPABASE_PROJECT_ID =
  import.meta.env.VITE_SUPABASE_PROJECT_ID || DEFAULT_SUPABASE_PROJECT_ID;

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const ADMIN_MAIL_SUPABASE_PROJECT_ID = "slptgamuhzxiacmbpgkq";
export const ADMIN_MAIL_SUPABASE_URL = "https://slptgamuhzxiacmbpgkq.supabase.co";
export const ADMIN_MAIL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_JoudyQj05l0JoIMVLiEJlw_77aFs14C";
