import { Resend } from 'resend';

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || 'RACHEL K3 <onboarding@resend.dev>';

let client: Resend | null = null;

function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

/**
 * Sends via Resend when RESEND_API_KEY is configured; otherwise logs and
 * no-ops so local dev without an API key doesn't crash calling flows.
 */
export async function sendEmail(params: { to: string; subject: string; html: string }) {
  const resend = getClient();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${params.to}: "${params.subject}"`);
    await recordEmail({ to: params.to, subject: params.subject, status: 'skipped', error: 'RESEND_API_KEY belum diset' });
    return { error: null };
  }

  let error: { message: string } | null = null;
  let providerId: string | null = null;
  try {
    const res = await resend.emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    error = res.error;
    providerId = res.data?.id ?? null;
  } catch (e: any) {
    error = { message: e?.message || 'Gagal mengirim email' };
  }

  if (error) {
    console.error('[email] Resend send failed:', error);
    await recordEmail({ to: params.to, subject: params.subject, status: 'failed', error: error.message });
    return { error: error.message };
  }
  await recordEmail({ to: params.to, subject: params.subject, status: 'sent', providerId });
  return { error: null };
}

/**
 * Mencatat percobaan kirim ke email_logs (lihat supabase/schema_email_logs.sql).
 * Best-effort: kegagalan mencatat TIDAK boleh menggagalkan alur pemanggil, dan
 * sebelum migrasi dijalankan insert-nya gagal diam-diam.
 */
async function recordEmail(entry: {
  to: string; subject: string; status: 'sent' | 'failed' | 'skipped'; error?: string | null; providerId?: string | null;
}) {
  try {
    const { createAdminClient } = await import('@/utils/supabase/admin');
    await createAdminClient().from('email_logs').insert({
      to_email: entry.to,
      subject: entry.subject,
      status: entry.status,
      error: entry.error ?? null,
      provider_id: entry.providerId ?? null,
    });
  } catch {
    // diabaikan — pencatatan hanya pelengkap.
  }
}

export function passwordResetEmailHtml(params: { name: string; password: string }) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Kata Sandi Direset</h2>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">
        Halo ${params.name},<br /><br />
        Administrator telah mereset kata sandi akun RACHEL K3 Anda. Gunakan kata sandi sementara di bawah ini untuk masuk, lalu segera ubah melalui halaman Profil Anda.
      </p>
      <div style="background: #f1f5f9; border-radius: 12px; padding: 16px 20px; margin: 20px 0; text-align: center;">
        <span style="font-family: monospace; font-size: 22px; font-weight: bold; letter-spacing: 2px; color: #0f172a;">${params.password}</span>
      </div>
      <p style="color: #64748b; font-size: 12px; line-height: 1.6;">
        Jika Anda tidak meminta perubahan ini, segera hubungi administrator sistem.
      </p>
    </div>
  `;
}
