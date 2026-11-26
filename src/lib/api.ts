import { useEffect, useState } from 'react'
import { emptyDB } from './dbutil'
import { RuleError } from './rules'
import { setClientState, StorageFullError } from './storage'
import type { DB, User } from './types'

/** Error devuelto por el servidor. `fields` trae errores por campo de formulario. */
export class ApiError extends RuleError {
  status: number
  fields?: Record<string, string>
  captcha?: boolean
  /** El servidor indica que hay que empezar el registro de nuevo. */
  restart?: boolean
  constructor(message: string, status: number, fields?: Record<string, string>, captcha?: boolean, restart?: boolean) {
    super(message)
    this.status = status
    this.fields = fields
    this.captcha = captcha
    this.restart = restart
  }
}

interface StatePayload {
  me?: User | null
  db?: DB
}

export async function api<T = unknown>(path: string, body?: unknown): Promise<T & StatePayload> {
  let res: Response
  try {
    res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión.', 0)
  }

  let data: Record<string, unknown> = {}
  try {
    data = await res.json()
  } catch {
    // Respuesta vacía o no JSON.
  }

  if (!res.ok) {
    if (res.status === 401) setClientState({ me: null, db: emptyDB() })
    const message = typeof data.error === 'string' ? data.error : 'Ocurrió un error. Inténtalo de nuevo.'
    if (res.status === 413) throw new StorageFullError(message)
    throw new ApiError(message, res.status, data.fields as Record<string, string> | undefined, data.captcha === true, data.restart === true)
  }

  if (data.db && 'me' in data) setClientState({ status: 'ready', me: (data.me as User | null) ?? null, db: data.db as DB })
  return data as T & StatePayload
}

/** Vuelve a pedir al servidor los datos del usuario actual. */
export async function refresh() {
  try {
    await api('/api/estado')
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) setClientState({ status: 'offline' })
    else throw err
  }
}

export interface AppConfig {
  captchaSiteKey: string | null
  demo: boolean
}

let configPromise: Promise<AppConfig> | null = null
const DEFAULT_CONFIG: AppConfig = { captchaSiteKey: null, demo: false }

export function useAppConfig(): AppConfig | null {
  const [cfg, setCfg] = useState<AppConfig | null>(null)
  useEffect(() => {
    configPromise ??= api<AppConfig>('/api/config').catch(() => {
      configPromise = null
      return DEFAULT_CONFIG
    })
    let alive = true
    configPromise.then((c) => alive && setCfg(c))
    return () => {
      alive = false
    }
  }, [])
  return cfg
}
