import { useState, useEffect, useRef, useCallback } from 'react'
import { IconSearch, IconPlus, IconTrash, IconUser, IconCalendar, IconClipboard, IconChevronDown, IconChevronUp } from './Icons'
import { useToast } from './Toast'

type Patient = PatientWithLastConsultation
type SortBy = 'name' | 'lastConsultation'
type SortOrder = 'asc' | 'desc'

export default function PatientList({
  onSelectPatient,
  onNewPatient,
  onRefresh,
}: {
  onSelectPatient: (id: number) => void
  onNewPatient: () => void
  onRefresh: number
}) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const { toast } = useToast()
  const sentinelRef = useRef<HTMLTableRowElement>(null)

  const handleSort = (column: SortBy) => {
    if (column === sortBy) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder(column === 'name' ? 'asc' : 'desc')
    }
  }

  // Carga inicial (o cuando cambia búsqueda/orden): resetea a página 0
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setPage(0)
    window.curo.patients
      .list(search || undefined, sortBy, sortOrder, 0)
      .then((result) => {
        if (!cancelled) {
          setPatients(result.patients)
          setTotal(result.total)
          setHasMore(result.hasMore)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [search, sortBy, sortOrder, onRefresh])

  // Carga de página siguiente (scroll infinito)
  const loadNextPage = useCallback(() => {
    if (loadingMore || !hasMore) return
    const nextPage = page + 1
    setLoadingMore(true)
    window.curo.patients
      .list(search || undefined, sortBy, sortOrder, nextPage)
      .then((result) => {
        setPatients((prev) => [...prev, ...result.patients])
        setTotal(result.total)
        setHasMore(result.hasMore)
        setPage(nextPage)
      })
      .finally(() => setLoadingMore(false))
  }, [loadingMore, hasMore, page, search, sortBy, sortOrder])

  // IntersectionObserver para detectar cuando el sentinel entra en vista
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadNextPage() },
      { threshold: 0.1 }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [loadNextPage])

  const handleDeactivate = (e: React.MouseEvent, id: number, name: string) => {
    e.stopPropagation()
    if (!window.confirm(`¿Está seguro de que desea eliminar a "${name}" de la lista de pacientes?`)) return
    setDeletingId(id)
    window.curo.patients
      .deactivate(id)
      .then(() => {
        setPatients((prev) => prev.filter((p) => p.id !== id))
        toast(`"${name}" desactivado correctamente`)
      })
      .catch(() => {
        toast(`No se pudo desactivar a "${name}". Intenta de nuevo.`, 'error')
      })
      .finally(() => setDeletingId(null))
  }

  const formatDateOnly = (d: string | null) => {
    if (!d) return '—'
    const datePart = d.includes('T') ? d.slice(0, 10) : d
    return new Date(datePart + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-stone-800">Pacientes</h2>
          {!loading && (
            <p className="mt-0.5 text-sm text-stone-500">
              {search
                ? `${total} ${total === 1 ? 'resultado' : 'resultados'}`
                : `${total} ${total === 1 ? 'paciente' : 'pacientes'}`}
            </p>
          )}
        </div>
        <button type="button" onClick={onNewPatient} className="btn-primary">
          <IconPlus />
          Nuevo paciente
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, póliza o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-stone-400">Cargando pacientes...</p>
        </div>
      ) : patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
            <IconUser className="text-stone-400" />
          </div>
          <p className="text-sm font-medium text-stone-500">
            {search ? 'Sin resultados para esta búsqueda' : 'Aún no hay pacientes'}
          </p>
          {!search && (
            <button type="button" onClick={onNewPatient} className="btn-primary mt-4">
              <IconPlus />
              Agregar primer paciente
            </button>
          )}
        </div>
      ) : (
        <div className="max-h-[calc(100vh-14rem)] min-h-0 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="min-w-full">
            <thead className="sticky top-0 z-10 border-b border-stone-100 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
              <tr className="border-b border-stone-100 bg-white">
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-brand-600">
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="inline-flex items-center gap-1.5 rounded-md py-0.5 pr-1 transition-colors hover:bg-brand-100/80 hover:text-brand-700"
                    title={sortBy === 'name' ? (sortOrder === 'asc' ? 'Orden ascendente (A→Z). Clic para descendente' : 'Orden descendente (Z→A). Clic para ascendente') : 'Ordenar por nombre'}
                  >
                    <IconUser className="size-4 shrink-0" />
                    Paciente
                    {sortBy === 'name' && (
                      <span aria-hidden>
                        {sortOrder === 'asc' ? (
                          <IconChevronUp className="size-3.5" />
                        ) : (
                          <IconChevronDown className="size-3.5" />
                        )}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-brand-600">
                  <span className="inline-flex items-center gap-1.5">
                    <IconClipboard className="size-4 shrink-0" />
                    Nº de póliza
                  </span>
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-brand-600">
                  <button
                    type="button"
                    onClick={() => handleSort('lastConsultation')}
                    className="inline-flex items-center gap-1.5 rounded-md py-0.5 pr-1 transition-colors hover:bg-brand-100/80 hover:text-brand-700"
                    title={sortBy === 'lastConsultation' ? (sortOrder === 'asc' ? 'Más antigua primero. Clic para más reciente primero' : 'Más reciente primero. Clic para más antigua primero') : 'Ordenar por última consulta'}
                  >
                    <IconCalendar className="size-4 shrink-0" />
                    Última consulta
                    {sortBy === 'lastConsultation' && (
                      <span aria-hidden>
                        {sortOrder === 'asc' ? (
                          <IconChevronUp className="size-3.5" />
                        ) : (
                          <IconChevronDown className="size-3.5" />
                        )}
                      </span>
                    )}
                  </button>
                </th>
                <th className="w-12 px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {patients.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => onSelectPatient(p.id)}
                  className="group cursor-pointer transition-colors hover:bg-brand-50/40"
                >
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-medium text-stone-800 group-hover:text-brand-700">
                      {p.name}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-stone-500">
                    {p.insurer_number || <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-stone-500">
                    {formatDateOnly(p.last_consultation_date)}
                  </td>
                  <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => handleDeactivate(e, p.id, p.name)}
                      disabled={deletingId === p.id}
                      className="rounded-lg p-1.5 text-stone-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
                      title="Desactivar paciente"
                    >
                      <IconTrash />
                    </button>
                  </td>
                </tr>
              ))}
              {/* Sentinel para scroll infinito */}
              {hasMore && (
                <tr ref={sentinelRef}>
                  <td colSpan={4} className="px-5 py-4 text-center text-xs text-stone-400">
                    {loadingMore ? 'Cargando más pacientes…' : ''}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
