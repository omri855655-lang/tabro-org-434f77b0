const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
};

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function base64Url(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemBytes(pem: string) {
  const binary = atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function safeEqual(actual: string, expected: string) {
  const actualBytes = new TextEncoder().encode(actual);
  const expectedBytes = new TextEncoder().encode(expected);
  if (actualBytes.length !== expectedBytes.length) return false;

  let mismatch = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    mismatch |= actualBytes[index] ^ expectedBytes[index];
  }
  return mismatch === 0;
}

async function workerIdentityToken(audience: string) {
  const credentials = JSON.parse(env("FINANCE_WORKER_GOOGLE_SERVICE_ACCOUNT")) as {
    client_email: string;
    private_key: string;
    private_key_id: string;
  };
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: credentials.private_key_id }));
  const claims = base64Url(JSON.stringify({
    iss: credentials.client_email,
    sub: credentials.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
    target_audience: audience,
  }));
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(credentials.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.id_token) throw new Error("Could not authorize the private finance worker");
  return body.id_token as string;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  const suppliedSecret = request.headers.get("x-cron-secret") || "";
  if (!safeEqual(suppliedSecret, env("FINANCE_CRON_SECRET"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
  }

  try {
    const workerUrl = env("FINANCE_WORKER_URL").replace(/\/$/, "");
    const identityToken = await workerIdentityToken(workerUrl);
    const response = await fetch(`${workerUrl}/sync-due`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${identityToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: 5 }),
      signal: AbortSignal.timeout(120_000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Finance worker returned HTTP ${response.status}`);
    return new Response(JSON.stringify(body), { headers: jsonHeaders });
  } catch (error) {
    console.error("finance-sync-due", error);
    return new Response(JSON.stringify({ error: "Scheduled finance sync failed" }), { status: 502, headers: jsonHeaders });
  }
});
