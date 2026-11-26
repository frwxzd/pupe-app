import nodemailer, { type Transporter } from 'nodemailer'
import { config, mailConfigured } from './config'

// Envío de correos por SMTP (Brevo, Resend, Gmail, el de tu hosting…).
// Sin SMTP configurado, en desarrollo el código se imprime en la consola del servidor.

let transport: Transporter | null = null
const getTransport = () =>
  (transport ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  }))

/** Solo pruebas automáticas: último código enviado a cada correo. */
export const lastCodes = new Map<string, string>()

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export type CodePurpose = 'registro' | 'recuperar'

const COPY: Record<CodePurpose, { subject: string; intro: string; outro: string }> = {
  registro: {
    subject: 'Código de verificación de PUPE',
    intro: 'Usa este código para activar tu cuenta en la plataforma de objetos perdidos y encontrados de CU2.',
    outro: 'Si no fuiste tú, ignora este correo: sin el código no se crea ninguna cuenta.',
  },
  recuperar: {
    subject: 'Código para restablecer tu contraseña de PUPE',
    intro: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta en PUPE. Usa este código para elegir una nueva.',
    outro: 'Si no fuiste tú, ignora este correo: tu contraseña no cambia sin el código.',
  },
}

export async function sendVerificationCode(to: string, name: string, code: string, minutes: number, purpose: CodePurpose = 'registro') {
  if (config.testMode) lastCodes.set(`${purpose}:${to}`, code)
  if (!mailConfigured()) {
    if (config.production) throw new Error('SMTP no configurado')
    console.warn(`[correo de desarrollo] Código de ${purpose} para ${to}: ${code}`)
    return
  }

  const copy = COPY[purpose]
  const firstRaw = name.split(' ')[0] || name
  const first = escape(firstRaw)
  const text = [
    `Hola, ${firstRaw}:`,
    '',
    copy.intro,
    '',
    `Código: ${code}`,
    '',
    `Vence en ${minutes} minutos. ${copy.outro}`,
  ].join('\n')

  const html = `<!doctype html><html><body style="margin:0;background:#F3F6F9;font-family:Arial,Helvetica,sans-serif;color:#0E2233">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
      <tr><td style="background:#06283D;padding:20px 28px;color:#ffffff;font-weight:bold;letter-spacing:2px;font-size:13px">PUPE · CU2 · BUAP</td></tr>
      <tr><td style="padding:28px">
        <p style="margin:0 0 12px;font-size:16px">Hola, ${first}:</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#4A5B6B">${copy.intro}</p>
        <p style="margin:0 0 20px;text-align:center;font-size:34px;font-weight:bold;letter-spacing:10px;color:#06283D;background:#E0F6FC;border-radius:12px;padding:16px 0">${code}</p>
        <p style="margin:0;font-size:13px;line-height:1.5;color:#5B6B7A">Vence en ${minutes} minutos. ${copy.outro}</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`

  await getTransport().sendMail({ from: config.smtp.from, to, subject: copy.subject, text, html })
}

/** Aviso de suspensión por inactividad (sin código). */
export async function sendSuspensionNotice(to: string, name: string, graceDays: number) {
  const subject = 'Tu cuenta de PUPE se suspendió por inactividad'
  const firstRaw = name.split(' ')[0] || name
  const lines = [
    'Tu cuenta en la plataforma de objetos perdidos y encontrados de CU2 no se ha usado en 6 meses, por lo que se suspendió.',
    `Si quieres conservarla, entra a PUPE, elige «¿Olvidaste tu contraseña?» y confirma el código que te enviaremos. Tienes ${graceDays} días.`,
    'Si no la reactivas, la cuenta y tus datos personales se eliminarán de forma definitiva.',
  ]
  if (!mailConfigured()) {
    if (config.production) throw new Error('SMTP no configurado')
    console.warn(`[correo de desarrollo] Aviso de suspensión para ${to}`)
    return
  }
  const text = [`Hola, ${firstRaw}:`, '', ...lines, '', config.publicUrl].join('\n')
  const html = `<!doctype html><html><body style="margin:0;background:#F3F6F9;font-family:Arial,Helvetica,sans-serif;color:#0E2233">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
      <tr><td style="background:#06283D;padding:20px 28px;color:#ffffff;font-weight:bold;letter-spacing:2px;font-size:13px">PUPE · CU2 · BUAP</td></tr>
      <tr><td style="padding:28px">
        <p style="margin:0 0 12px;font-size:16px">Hola, ${escape(firstRaw)}:</p>
        ${lines.map((l) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#4A5B6B">${escape(l)}</p>`).join('')}
        <p style="margin:20px 0 0;text-align:center"><a href="${escape(config.publicUrl)}/login" style="display:inline-block;background:#00B5E2;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Ir a PUPE</a></p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`
  await getTransport().sendMail({ from: config.smtp.from, to, subject, text, html })
}
