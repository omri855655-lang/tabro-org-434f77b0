type Environment = { get(name: string): string | undefined };
export async function fetchAI(init: RequestInit, env: Environment = Deno.env, send: typeof fetch = fetch) {
  const key = env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY is not configured');
  if (env.get('AI_ENABLED') === 'false') throw new Error('AI is disabled');
  if (typeof init.body !== 'string') throw new Error('AI request must be JSON');
  const body = JSON.parse(init.body);
  if (typeof body.model !== 'string' || !Array.isArray(body.messages)) throw new Error('Invalid AI request');
  body.model = body.model.replace(/^google\//, '');
  if (body.model.includes('pro')) body.model = env.get('GEMINI_PRO_MODEL') || body.model;
  else body.model = env.get('GEMINI_FLASH_MODEL') || body.model;
  const cap = Number(env.get('AI_MAX_OUTPUT_TOKENS') || '8192');
  if (!Number.isInteger(cap) || cap < 128 || cap > 32768) throw new Error('Invalid AI output limit');
  body.max_tokens = Math.min(cap, Number.isInteger(body.max_tokens) && body.max_tokens > 0 ? body.max_tokens : cap);
  return send('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    ...init, signal: init.signal || AbortSignal.timeout(45000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
}
