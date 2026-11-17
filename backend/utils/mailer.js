// Отправка писем через Brevo (ранее Sendinblue) — бесплатный план без привязки домена,
// достаточно подтвердить один отправительский email (Single Sender).
// Если BREVO_API_KEY не задан — просто не отправляем письма (используется для разработки
// или пока отправитель не настроен, тогда email не подтверждается кодом автоматически).

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function isMailerConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.MAIL_FROM_EMAIL);
}

async function sendVerificationEmail(toEmail, code) {
  if (!isMailerConfigured()) {
    return { sent: false, reason: 'not_configured' };
  }

  const fetchFn = global.fetch || require('node-fetch');

  const res = await fetchFn(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        email: process.env.MAIL_FROM_EMAIL,
        name: process.env.MAIL_FROM_NAME || 'AdSpy',
      },
      to: [{ email: toEmail }],
      subject: 'Код подтверждения AdSpy',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; font-size: 15px; color: #1a1a1a;">
          <p>Твой код подтверждения для AdSpy:</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${code}</p>
          <p style="color: #666;">Код действует 15 минут. Если ты не регистрировался(ась) на AdSpy — просто проигнорируй это письмо.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Brevo API error ${res.status}: ${text}`);
  }

  return { sent: true };
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

module.exports = { sendVerificationEmail, isMailerConfigured, generateCode };
