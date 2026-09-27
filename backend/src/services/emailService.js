const nodemailer = require("nodemailer");

/**
 * Outbound email.
 *
 * Two modes, chosen from the environment:
 *  - SMTP: when SMTP_HOST is set, mail is really delivered. Supports implicit
 *    TLS (SMTP_SECURE=true) as well as STARTTLS.
 *  - Console: otherwise. The message is logged instead of sent, so local and
 *    test environments work without credentials.
 *
 * Every send is best-effort: a mail outage must never fail the request that
 * triggered it. `send()` resolves to { delivered, reason } and callers decide
 * what to surface.
 */

const BRAND = process.env.MAIL_FROM_NAME || "NEXUS";

const smtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);

const cleanEmail = (value) =>
    typeof value === "string" ? value.trim().toLowerCase() : "";

const webBase = () =>
    (process.env.APP_URL || process.env.CLIENT_URL || "http://localhost:3000").replace(/\/+$/, "");

let transporter = null;

const getTransporter = () => {
    if (transporter) {
        return transporter;
    }

    if (!smtpConfigured()) {
        return null;
    }

    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
        auth: process.env.SMTP_USER
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
            : undefined
    });

    return transporter;
};

// Reset and verification links have to point at the frontend, not the API.
const link = (path, token) => `${webBase()}${path}?token=${encodeURIComponent(token)}`;

const TEMPLATES = {
    password_reset: ({ token, name }) => ({
        toLine: name ? `Hi ${name},` : "Hi,",
        subject: "Reset your NEXUS password",
        heading: "Reset your password",
        body: "We received a request to reset the password on your NEXUS account. Choose a new password using the link below. If you did not ask for this, you can ignore this email and nothing will change.",
        action: "Reset password",
        href: link("/reset-password", token),
        footer: "This link expires in 30 minutes and can only be used once."
    }),
    email_verification: ({ token, name }) => ({
        toLine: name ? `Hi ${name},` : "Hi,",
        subject: "Verify your NEXUS email",
        heading: "Confirm your email address",
        body: "Welcome to NEXUS. Confirm this address to finish setting up your account and make sure password resets reach you.",
        action: "Verify email",
        href: link("/email-verification", token),
        footer: "This link expires in 48 hours and can only be used once."
    }),
    workspace_invite: ({ token, name, organization, inviter }) => ({
        toLine: name ? `Hi ${name},` : "Hi,",
        subject: `You have been invited to ${organization}`,
        heading: "Join the workspace",
        body: `${inviter} invited you to join ${organization} on NEXUS. Accept the invitation to get access to its projects, tasks, and files.`,
        action: "Accept invitation",
        href: link("/accept-invite", token),
        footer: "If you were not expecting this invitation, you can ignore this email."
    })
};

const escapeHtml = (value) =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const renderHtml = (template) => `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#111827">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb">
      <tr><td style="padding:28px 32px 8px">
        <span style="font-weight:700;letter-spacing:-0.01em">NEXUS</span>
      </td></tr>
      <tr><td style="padding:8px 32px 0">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6">${escapeHtml(template.toLine)}</p>
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(template.heading)}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151">${escapeHtml(template.body)}</p>
        <a href="${escapeHtml(template.href)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600">${escapeHtml(template.action)}</a>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280">${escapeHtml(template.footer)}</p>
      </td></tr>
      <tr><td style="padding:16px 32px 28px">
        <p style="margin:0;font-size:12px;color:#9ca3af">If the button does not work, copy this link into your browser:<br />${escapeHtml(template.href)}</p>
      </td></tr>
    </table>
  </body>
</html>`;

const renderText = (template) =>
    [
        template.toLine,
        "",
        template.heading,
        "",
        template.body,
        "",
        `${template.action}: ${template.href}`,
        "",
        template.footer
    ].join("\n");

/**
 * Sends a templated message. Never throws.
 *
 * @param {"password_reset"|"email_verification"|"workspace_invite"} kind
 * @param {{ to: string, token: string, name?: string, organization?: string, inviter?: string }} payload
 * @returns {Promise<{ delivered: boolean, reason: string }>}
 */
const send = async (kind, payload) => {
    const template = TEMPLATES[kind];

    if (!template) {
        return { delivered: false, reason: `unknown email kind: ${kind}` };
    }

    const to = cleanEmail(payload.to);

    if (!to) {
        return { delivered: false, reason: "missing recipient" };
    }

    const built = template(payload);
    const mail = getTransporter();

    if (!mail) {
        // Console mode: the operator reads the link here, and the local
        // "Continue with this token" button still works from the API response.
        console.log(
            `[mail:console] to=${to} subject="${built.subject}" link=${built.href}`
        );

        return { delivered: false, reason: "console" };
    }

    try {
        await mail.sendMail({
            from: process.env.MAIL_FROM || `"${BRAND}" <${process.env.SMTP_USER}>`,
            to,
            subject: built.subject,
            text: renderText(built),
            html: renderHtml(built)
        });

        return { delivered: true, reason: "smtp" };
    } catch (error) {
        // Deliberately swallowed: the account action already succeeded, and a
        // failed notification must not report the action as failed.
        console.error(`[mail] ${kind} to=${to} failed: ${error.message}`);

        return { delivered: false, reason: error.message };
    }
};

const isConfigured = () => smtpConfigured();

module.exports = {
    send,
    isConfigured,
    buildLink: link,
    TEMPLATES
};
