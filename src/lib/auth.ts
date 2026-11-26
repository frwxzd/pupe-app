import { api, ApiError } from './api'
import { useClientState } from './storage'
import type { User } from './types'

export { hasAcceptedTerms, needsTerms } from './dbutil'

/** Usuario de la sesión actual, según el servidor. */
export function useCurrentUser(): User | null {
  return useClientState().me
}

export type AuthResult =
  | { ok: true; pending?: boolean }
  | { ok: false; errors: Record<string, string>; captcha?: boolean; restart?: boolean }

async function authCall(path: string, body: Record<string, unknown>): Promise<AuthResult> {
  try {
    const data = await api<{ pending?: boolean }>(path, body)
    return { ok: true, pending: data.pending === true }
  } catch (err) {
    if (err instanceof ApiError) {
      const errors = err.fields ? { ...err.fields } : { form: err.message }
      return { ok: false, errors, captcha: err.captcha, restart: err.restart }
    }
    return { ok: false, errors: { form: 'No se pudo completar la solicitud.' } }
  }
}

export const login = (email: string, password: string, captcha: string) =>
  authCall('/api/auth/login', { email, password, captcha })

/** Paso 1 del registro: valida los datos y envía un código al correo. No crea la cuenta todavía. */
export const registerStudent = (data: { name: string; email: string; matricula: string; password: string; captcha: string }) =>
  authCall('/api/auth/registro', data)

/** Paso 2 del registro: con el código correcto se crea la cuenta y se inicia sesión. */
export const verifyEmail = (email: string, code: string) => authCall('/api/auth/verificar', { email, code })

export const resendEmailCode = (email: string) => authCall('/api/auth/reenviar', { email })

/** Recuperar contraseña, paso 1: pide un código al correo (la respuesta no revela si la cuenta existe). */
export const requestPasswordReset = (email: string, captcha: string) => authCall('/api/auth/recuperar', { email, captcha })

export const resendPasswordReset = (email: string) => authCall('/api/auth/recuperar/reenviar', { email })

/** Recuperar contraseña, paso 2: código + contraseña nueva. */
export const resetPassword = (email: string, code: string, password: string) =>
  authCall('/api/auth/restablecer', { email, code, password })

export const changePassword = (current: string, next: string) =>
  authCall('/api/auth/password', { current, next })

export async function logout() {
  await api('/api/auth/logout', {}).catch(() => undefined)
}
