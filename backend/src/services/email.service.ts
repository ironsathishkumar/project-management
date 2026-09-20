import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let transporterPromise: Promise<Transporter | null> | null = null;

async function getTransporter(): Promise<Transporter | null> {
  if (!env.smtpHost) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: env.smtpUser
      ? {
          user: env.smtpUser,
          pass: env.smtpPass,
        }
      : undefined,
  });
}

async function resolveTransporter(): Promise<Transporter | null> {
  if (!transporterPromise) {
    transporterPromise = getTransporter().catch((error) => {
      logger.error('Failed to initialize mail transporter', { error });
      return null;
    });
  }
  return transporterPromise;
}

function wrapHtml(title: string, bodyHtml: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4F1EA;font-family:Georgia,serif;color:#1C1917;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFEFB;border:1px solid #E7E0D6;border-radius:16px;padding:28px;">
            <tr>
              <td>
                <div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#78716C;font-weight:700;">Project Tracker</div>
                <h1 style="margin:12px 0 16px;font-size:24px;font-weight:600;">${title}</h1>
                <div style="font-size:15px;line-height:1.6;color:#44403C;">${bodyHtml}</div>
                <p style="margin-top:28px;font-size:12px;color:#A8A29E;">Sent by Project Tracker</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const emailService = {
  isConfigured() {
    return Boolean(env.smtpHost);
  },

  async send(payload: MailPayload) {
    const transporter = await resolveTransporter();
    const from = env.smtpFrom;

    if (!transporter) {
      logger.info('[mail:dev] Email not sent (SMTP not configured)', {
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
      });
      return { ok: true, mode: 'log' as const };
    }

    try {
      const info = await transporter.sendMail({
        from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html ?? wrapHtml(payload.subject, `<p>${payload.text}</p>`),
      });
      logger.info('[mail] Sent', { to: payload.to, subject: payload.subject, messageId: info.messageId });
      return { ok: true, mode: 'smtp' as const, messageId: info.messageId };
    } catch (error) {
      logger.error('[mail] Failed to send', { to: payload.to, subject: payload.subject, error });
      return { ok: false, mode: 'smtp' as const, error };
    }
  },

  async sendWorkspaceInvite(input: {
    to: string;
    inviteeName: string;
    workspaceName: string;
    roleName: string;
    invitedBy: string;
  }) {
    const link = `${env.appUrl}/login`;
    const subject = `You're invited to ${input.workspaceName}`;
    const text = `${input.invitedBy} invited you to the workspace “${input.workspaceName}” as ${input.roleName}. Sign in at ${link}`;
    const html = wrapHtml(
      'Workspace invite',
      `<p>Hi ${input.inviteeName},</p>
       <p><strong>${input.invitedBy}</strong> invited you to <strong>${input.workspaceName}</strong> as <strong>${input.roleName}</strong>.</p>
       <p><a href="${link}" style="display:inline-block;margin-top:8px;padding:10px 16px;background:#1F4E79;color:#fff;text-decoration:none;border-radius:999px;font-weight:700;">Open Project Tracker</a></p>`
    );
    return this.send({ to: input.to, subject, text, html });
  },

  async sendProjectAssigned(input: {
    to: string;
    inviteeName: string;
    projectName: string;
    projectKey: string;
    roleName: string;
    invitedBy: string;
    projectId: string;
  }) {
    const link = `${env.appUrl}/projects/${input.projectId}/board`;
    const subject = `Added to ${input.projectKey} · ${input.projectName}`;
    const text = `${input.invitedBy} added you to project “${input.projectName}” as ${input.roleName}. Open ${link}`;
    const html = wrapHtml(
      'Project assignment',
      `<p>Hi ${input.inviteeName},</p>
       <p><strong>${input.invitedBy}</strong> added you to <strong>${input.projectKey} · ${input.projectName}</strong> as <strong>${input.roleName}</strong>.</p>
       <p><a href="${link}" style="display:inline-block;margin-top:8px;padding:10px 16px;background:#1F4E79;color:#fff;text-decoration:none;border-radius:999px;font-weight:700;">Open board</a></p>`
    );
    return this.send({ to: input.to, subject, text, html });
  },

  async sendTaskAssigned(input: {
    to: string;
    inviteeName: string;
    taskTitle: string;
    taskKey?: string;
    projectName?: string;
    taskId: string;
  }) {
    const link = `${env.appUrl}/tasks?open=${input.taskId}`;
    const label = input.taskKey ? `${input.taskKey} · ${input.taskTitle}` : input.taskTitle;
    const subject = `Assigned: ${label}`;
    const text = `You were assigned “${label}”${input.projectName ? ` in ${input.projectName}` : ''}. Open ${link}`;
    const html = wrapHtml(
      'Task assigned',
      `<p>Hi ${input.inviteeName},</p>
       <p>You were assigned <strong>${label}</strong>${input.projectName ? ` in <strong>${input.projectName}</strong>` : ''}.</p>
       <p><a href="${link}" style="display:inline-block;margin-top:8px;padding:10px 16px;background:#1F4E79;color:#fff;text-decoration:none;border-radius:999px;font-weight:700;">View task</a></p>`
    );
    return this.send({ to: input.to, subject, text, html });
  },
};
