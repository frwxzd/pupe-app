import type { BuildingScopeState } from '../lib/useBuildingScope'

export function BuildingSelect({ scope }: { scope: BuildingScopeState }) {
  if (!scope.isSuper) {
    return <span className="inline-flex items-center rounded-full bg-navbar text-white px-3 py-1 text-sm font-bold">{scope.selected}</span>
  }
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="scope" className="text-sm font-bold text-titulo">Edificio</label>
      <select id="scope" className="input w-auto" value={scope.selected} onChange={(e) => scope.setSelected(e.target.value)}>
        <option value="">Todos</option>
        {scope.allowed.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  )
}
