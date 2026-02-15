import { transporter, MAIL_FROM } from '../config/email.js';
import logger from '../utils/logger.js';

/**
 * Send a password reset email.
 * Does NOT throw on failure — logs the error and continues.
 * In development, logs the reset URL to console for testing.
 * @param {{ to: string, resetUrl: string, fullName: string }} params
 */
export async function sendPasswordResetEmail({ to, resetUrl, fullName }) {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    logger.info('Password reset URL (dev mode)', { to, resetUrl });
  }

  try {
    await transporter.sendMail({
      from: `"KinTales" <${MAIL_FROM}>`,
      to,
      subject: 'KinTales — Нулиране на парола',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Нулиране на парола</h2>
          <p>Здравей, ${escapeHtml(fullName)}!</p>
          <p>Получихме заявка за нулиране на паролата на твоя KinTales акаунт.</p>
          <p>
            <a href="${escapeHtml(resetUrl)}"
               style="display: inline-block; padding: 12px 24px; background: #4F46E5;
                      color: white; text-decoration: none; border-radius: 6px;">
              Нулирай паролата
            </a>
          </p>
          <p>Линкът е валиден 15 минути. Ако не си поискал нулиране, игнорирай този имейл.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">KinTales — Семейното дърво на твоя род</p>
        </div>
      `,
    });
    logger.debug('Password reset email sent', { to });
  } catch (err) {
    logger.error('Failed to send password reset email', {
      to,
      error: err.message,
    });
  }
}

/**
 * Send a guardian invite email.
 * Does NOT throw on failure — logs the error and continues.
 * @param {{ to: string, guardianName: string, treeName: string, assignerName: string }} params
 */
export async function sendGuardianInviteEmail({ to, guardianName, treeName, assignerName }) {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    logger.info('Guardian invite (dev mode)', { to, guardianName, treeName });
  }

  try {
    await transporter.sendMail({
      from: `"KinTales" <${MAIL_FROM}>`,
      to,
      subject: 'KinTales — Покана за пазител на семейно дърво',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Покана за пазител</h2>
          <p>Здравей, ${escapeHtml(guardianName)}!</p>
          <p>${escapeHtml(assignerName)} те назначи за пазител на семейно дърво
             <strong>${escapeHtml(treeName)}</strong> в KinTales.</p>
          <p>Като пазител ще имаш достъп до дървото при нужда (наследяване, недееспособност).</p>
          <p>Ако вече имаш акаунт в KinTales, влез и провери секцията за пазителства.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">KinTales — Семейното дърво на твоя род</p>
        </div>
      `,
    });
    logger.debug('Guardian invite email sent', { to });
  } catch (err) {
    logger.error('Failed to send guardian invite email', {
      to,
      error: err.message,
    });
  }
}

/**
 * Send a legacy key invite email.
 * Does NOT throw on failure — logs the error and continues.
 * @param {{ to: string, recipientName: string, treeName: string, keyCode: string, senderName: string }} params
 */
export async function sendLegacyKeyEmail({ to, recipientName, treeName, keyCode, senderName }) {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    logger.info('Legacy key email (dev mode)', { to, keyCode, treeName });
  }

  try {
    await transporter.sendMail({
      from: `"KinTales" <${MAIL_FROM}>`,
      to,
      subject: 'KinTales — Покана за семейно дърво',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Покана за семейно дърво</h2>
          <p>Здравей${recipientName ? `, ${escapeHtml(recipientName)}` : ''}!</p>
          <p>${escapeHtml(senderName)} те кани да се присъединиш към семейно дърво
             <strong>${escapeHtml(treeName)}</strong> в KinTales.</p>
          <p>Твоят код за достъп е:</p>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;
                    background: #f3f4f6; padding: 16px; text-align: center;
                    border-radius: 8px; font-family: monospace;">
            ${escapeHtml(keyCode)}
          </p>
          <p>Регистрирай се в KinTales и въведи този код, за да се присъединиш към дървото.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">KinTales — Семейното дърво на твоя род</p>
        </div>
      `,
    });
    logger.debug('Legacy key email sent', { to });
  } catch (err) {
    logger.error('Failed to send legacy key email', {
      to,
      error: err.message,
    });
  }
}

/**
 * Escape HTML special characters to prevent XSS in email templates.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}
