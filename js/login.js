import { getSupabase, getCurrentUserAndProfile, isSupabaseConfigured, requireConfiguredSupabaseMessage } from './supabaseClient.js';

const $ = (sel) => document.querySelector(sel);
const message = $('#auth-message');

function setMessage(text, type = '') {
  if (!message) return;
  message.textContent = text || '';
  message.className = `auth-message ${type}`.trim();
}

function nextUrl() {
  const params = new URLSearchParams(location.search);
  return params.get('next') || 'index.html';
}

function switchAuthTab(tab) {
  document.querySelectorAll('[data-auth-tab]').forEach((btn) => btn.classList.toggle('active', btn.dataset.authTab === tab));
  document.querySelectorAll('[data-auth-form]').forEach((form) => form.classList.toggle('active', form.dataset.authForm === tab));
  setMessage('');
}

async function redirectByRole(supabase) {
  const { user, profile } = await getCurrentUserAndProfile(supabase);
  if (!user) return;
  const intended = nextUrl();
  if (profile?.tipo === 'mestre' && (!intended || intended === 'index.html')) {
    location.href = 'mestre.html';
  } else {
    location.href = intended;
  }
}

async function init() {
  document.querySelectorAll('[data-auth-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTab));
  });

  if (!isSupabaseConfigured()) {
    requireConfiguredSupabaseMessage(message);
    document.querySelectorAll('button[type="submit"]').forEach((btn) => { btn.disabled = true; });
    return;
  }

  let supabase;
  try {
    supabase = await getSupabase();
  } catch (err) {
    setMessage(`Falha ao carregar Supabase: ${err.message}`, 'error');
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await redirectByRole(supabase);
    return;
  }

  $('#login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage('Autenticando por e-mail e senha...', '');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(`Login recusado: ${error.message}`, 'error');
      return;
    }
    setMessage('Login aceito. Redirecionando...', 'ok');
    await redirectByRole(supabase);
  });

  $('#signup-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage('Criando cadastro por e-mail e senha...', '');
    const form = new FormData(event.currentTarget);
    const nome = String(form.get('nome') || '').trim();
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');

    if (!nome || !email || !password) {
      setMessage('Preencha nome, e-mail e senha.', 'error');
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome } }
    });

    if (error) {
      setMessage(`Cadastro recusado: ${error.message}`, 'error');
      return;
    }

    if (data.session?.user) {
      setMessage('Cadastro criado. Redirecionando...', 'ok');
      await redirectByRole(supabase);
    } else {
      setMessage('Cadastro criado. Se a confirmação de e-mail estiver ativa no Supabase, confirme o e-mail antes de entrar. O sistema não usa OTP/MFA/SMS/social.', 'ok');
      switchAuthTab('login');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
