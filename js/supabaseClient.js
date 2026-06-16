import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

let clientPromise = null;

export function isSupabaseConfigured() {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('COLE_AQUI') &&
    !SUPABASE_ANON_KEY.includes('COLE_AQUI')
  );
}

export async function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce'
        },
        realtime: {
          params: { eventsPerSecond: 5 }
        }
      }));
  }
  return clientPromise;
}

export function redirectWithNext(path = 'login.html') {
  const next = `${location.pathname.split('/').pop() || 'index.html'}${location.search || ''}${location.hash || ''}`;
  location.href = `${path}?next=${encodeURIComponent(next)}`;
}

export function humanDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

export async function getCurrentUserAndProfile(supabase) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return { user: null, profile: null };

  let { data: profile, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) throw error;

  // Fallback caso o gatilho de criação de perfil ainda não tenha rodado.
  if (!profile) {
    const nome = session.user.user_metadata?.nome || session.user.email?.split('@')[0] || 'Jogador';
    await supabase
      .from('usuarios')
      .upsert({ id: session.user.id, nome, email: session.user.email }, { onConflict: 'id' });
    const { data: inserted, error: insertError } = await supabase
      .from('perfis')
      .insert({ user_id: session.user.id, nome_publico: nome, tipo: 'jogador' })
      .select('*')
      .single();
    if (insertError) throw insertError;
    profile = inserted;
  }

  return { user: session.user, profile };
}

export function requireConfiguredSupabaseMessage(target) {
  const msg = 'Supabase ainda não configurado. Cole SUPABASE_URL e SUPABASE_ANON_KEY em config.js.';
  if (target) {
    target.textContent = msg;
    target.classList?.add('error');
  }
  return msg;
}
