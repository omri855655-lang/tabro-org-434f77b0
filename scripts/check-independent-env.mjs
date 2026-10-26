const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PROJECT_ID', 'VITE_SUPABASE_PUBLISHABLE_KEY'];
for (const name of required) if (!process.env[name]?.trim()) throw new Error(`Missing ${name}`);
const url = new URL(process.env.VITE_SUPABASE_URL);
if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Expected HTTPS Supabase endpoint');
if (url.hostname !== `${process.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`) throw new Error('Supabase URL and project ID must match');
if (url.hostname.includes('isnhgyycowmnlxtmbmwm') || process.env.VITE_SUPABASE_PROJECT_ID === 'isnhgyycowmnlxtmbmwm') {
  throw new Error('Preview must use the confirmed owner-controlled target, not a previous Cloud project');
}
console.log('Independent preview configuration present; no secret values printed.');
