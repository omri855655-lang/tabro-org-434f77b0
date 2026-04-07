import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email";

function getRedirectUri() {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/gmail-auth?action=callback`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    // Handle OAuth callback from Google (GET redirect)
    if (action === "callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state"); // contains user_id
      const error = url.searchParams.get("error");

      if (error) {
        return new Response(`<html><body><script>window.close();</script>OAuth error: ${error}</body></html>`, {
          headers: { "Content-Type": "text/html" },
        });
      }

      if (!code || !state) {
        return new Response(`<html><body><script>window.close();</script>Missing params</body></html>`, {
          headers: { "Content-Type": "text/html" },
        });
      }

      // Exchange code for tokens
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
          client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
          redirect_uri: getRedirectUri(),
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenRes.json();
      if (tokens.error) {
        return new Response(`<html><body><script>window.close();</script>Token error: ${tokens.error_description}</body></html>`, {
          headers: { "Content-Type": "text/html" },
        });
      }

      // Get user email from Google
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileRes.json();

      // Save connection with tokens
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      await serviceClient.from("email_connections").upsert({
        user_id: state,
        provider: "gmail",
        email_address: profile.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        settings: { token_expiry: Date.now() + (tokens.expires_in * 1000) },
      } as any, { onConflict: "user_id,provider,email_address" });

      return new Response(
        `<html><body><script>window.opener && window.opener.postMessage({type:'gmail-connected',email:'${profile.email}'},'*');window.close();</script><p>Connected! You can close this window.</p></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // POST actions require auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsH });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsH });

    const body = await req.json();

    if (body.action === "get_auth_url") {
      const params = new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        redirect_uri: getRedirectUri(),
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",
        state: user.id,
      });

      return new Response(JSON.stringify({ url: `${GOOGLE_AUTH_URL}?${params}` }), {
        headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsH });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsH });
  }
});
