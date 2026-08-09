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
    return { error: null };
  }

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    console.error('[email] Resend send failed:', error);
    return { error: error.message };
  }
  return { error: null };
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
