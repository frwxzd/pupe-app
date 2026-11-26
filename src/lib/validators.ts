import { ALLOWED_DOMAINS } from './constants'

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@')
  return at === -1 ? '' : email.slice(at + 1).toLowerCase()
}

export function validateEmail(email: string): string | null {
  const value = email.trim().toLowerCase()
  if (!value) return 'Escribe tu correo institucional.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'El correo no tiene un formato válido.'
  if (!ALLOWED_DOMAINS.includes(emailDomain(value))) {
    return `Solo se aceptan correos ${ALLOWED_DOMAINS.map((d) => '@' + d).join(', ')}.`
  }
  return null
}

export function validateMatricula(matricula: string): string | null {
  const value = matricula.trim()
  if (!value) return 'Escribe tu matrícula.'
  if (!/^\d{9}$/.test(value)) return 'La matrícula debe tener 9 dígitos.'
  if (!value.startsWith('202')) return 'La matrícula debe empezar con 202.'
  return null
}

export function validateRequired(value: string | undefined, label: string): string | null {
  return value && value.trim() ? null : `${label} es obligatorio.`
}

export function validateLast4(value: string): string | null {
  return /^\d{4}$/.test(value.trim()) ? null : 'Deben ser 4 dígitos.'
}

export const PASSWORD_MIN = 10

/** Contraseña: mínimo 10 caracteres, con letras y números, y distinta de la matrícula o el correo. */
export function validatePassword(password: string, ctx: { email?: string; matricula?: string } = {}): string | null {
  if (!password) return 'Escribe una contraseña.'
  if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`
  if (password.length > 128) return 'La contraseña es demasiado larga (máximo 128 caracteres).'
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(password) || !/\d/.test(password)) return 'La contraseña debe combinar letras y números.'
  const lower = password.toLowerCase()
  if (ctx.matricula && lower.includes(ctx.matricula.trim())) return 'La contraseña no puede contener tu matrícula.'
  const local = ctx.email?.split('@')[0]?.toLowerCase()
  if (local && local.length >= 4 && lower.includes(local)) return 'La contraseña no puede contener tu correo.'
  return null
}
