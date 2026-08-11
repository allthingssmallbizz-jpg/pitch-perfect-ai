// Custom transactional email — separate from Supabase Auth's own emails (invite/confirm/
// recovery), which go through whatever's configured in Supabase's Auth SMTP settings. This path
// exists because Supabase's built-in templates can't include a plaintext password: sending
// someone their actual login credentials (src/lib/actions/admin.ts's adminInviteMember /
// adminResendCredentials) needs a real custom email, not an auth link. Uses Resend's REST API
// directly rather than the Resend SDK — a single POST doesn't need a dependency for it.

const RESEND_API_URL = "https://api.resend.com/emails";

export class EmailSendError extends Error {}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new EmailSendError(
      "Email sending isn't configured yet — RESEND_API_KEY and RESEND_FROM_EMAIL need to be set in your hosting provider's environment variables."
    );
  }

  let res: Response;
  try {
    res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
  } catch {
    throw new EmailSendError("Couldn't reach the email service — try again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new EmailSendError(body?.message || `Email service returned an error (${res.status}).`);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Shared body for both the initial welcome email (adminInviteMember) and the resend/regenerate
// flow (adminResendCredentials) — same content either way, since a resend is functionally "here
// are your current login details" regardless of whether this is the first time or not.
export function buildLoginCredentialsEmail(params: { fullName: string | null; email: string; password: string }): {
  subject: string;
  html: string;
} {
  const { fullName, email, password } = params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const greeting = fullName ? `Hi ${escapeHtml(fullName)},` : "Hi,";

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <h1 style="font-size: 20px;">Welcome to Pitch Perfect AI</h1>
      <p>${greeting}</p>
      <p>Your account is ready. Here's how to log in:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0;"><strong>${escapeHtml(email)}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Password</td><td style="padding: 8px 0;"><strong>${escapeHtml(password)}</strong></td></tr>
      </table>
      ${appUrl ? `<p><a href="${escapeHtml(appUrl)}/login" style="display: inline-block; background: #111; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Log in</a></p>` : ""}
      <p style="color: #666; font-size: 13px;">Once you're in, you can change this password anytime from Settings.</p>
    </div>
  `;

  return { subject: "Your Pitch Perfect AI login details", html };
}
