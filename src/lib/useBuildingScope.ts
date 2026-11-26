import { useSearchParams } from 'react-router-dom'
import { useCurrentUser } from './auth'
import { staffBuildings } from './queries'
import { useDB } from './storage'

/**
 * Edificio sobre el que trabaja el panel.
 * - Encargado: siempre su edificio (no se puede cambiar, aunque se edite la URL).
 * - Super admin: puede elegir uno o ver todos ('').
 */
export function useBuildingScope() {
  const user = useCurrentUser()
  const db = useDB()
  const [params, setParams] = useSearchParams()
  const allowed = staffBuildings(db, user)
  const isSuper = user?.role === 'super_admin'
  const requested = params.get('edificio') ?? ''
  const selected = isSuper ? (allowed.includes(requested) ? requested : '') : (allowed[0] ?? '__none__')

  const setSelected = (code: string) => {
    const next = new URLSearchParams(params)
    if (code) next.set('edificio', code)
    else next.delete('edificio')
    setParams(next, { replace: true })
  }

  const inScope = (code: string) => (selected === '' ? allowed.includes(code) : code === selected)
  return { selected, setSelected, allowed, isSuper, inScope }
}

export type BuildingScopeState = ReturnType<typeof useBuildingScope>
