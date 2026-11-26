import { useSyncExternalStore } from 'react'
import { emptyDB } from './dbutil'
import type { DB, User } from './types'

// Copia local de los datos que el servidor permite ver al usuario actual.
// El navegador no guarda nada en localStorage: todo cambio pasa por la API.

export type LoadStatus = 'loading' | 'ready' | 'offline'

export interface ClientState {
  status: LoadStatus
  me: User | null
  db: DB
}

let state: ClientState = { status: 'loading', me: null, db: emptyDB() }
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setClientState(next: Partial<ClientState>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export const getClientState = () => state

export function useClientState(): ClientState {
  return useSyncExternalStore(subscribe, getClientState, getClientState)
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, () => state.db, () => state.db)
}

/** El servidor rechazó las fotos por tamaño. */
export class StorageFullError extends Error {
  constructor(message = 'Las fotos son demasiado pesadas. Usa menos fotos o imágenes más ligeras.') {
    super(message)
  }
}
