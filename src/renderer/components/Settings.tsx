import { useState, useEffect, useCallback, useRef } from 'react'
import { IconArrowLeft, IconFolder, IconDownload, IconUpload, IconUndo, IconHistory, IconKey, IconInfo } from './Icons'
import { useToast } from './Toast'

const ACTIVITY_LOG_LIMIT = 80
const PROVIDER_PASSWORD = 'acalzada22123'

// ── InfoTooltip ──────────────────────────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div
      ref={ref}
      className="relative ml-auto"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-5 w-5 items-center justify-center text-stone-400"
        aria-label="Más información"
      >
        <IconInfo />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-64 rounded-xl border border-stone-200 bg-white p-3 shadow-lg">
          <p className="text-xs leading-relaxed text-stone-600">{text}</p>
        </div>
      )}
    </div>
  )
}

// ── ProviderPanel ─────────────────────────────────────────────────────────────
function ProviderPanel({ onRevoked }: { onRevoked: () => void }) {
  const [unlocked, setUnlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const handler = () => setUnlocked(true)
    document.addEventListener('provider:open', handler)
    return () => document.removeEventListener('provider:open', handler)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === PROVIDER_PASSWORD) {
      setError(false)
      setUnlocked(true)
    } else {
      setError(true)
      setPassword('')
    }
  }

  const handleRevoke = async () => {
    if (!window.confirm('¿Revocar la licencia? El usuario perderá acceso y deberá activar una nueva clave.')) return
    await window.curo.license.revoke()
    toast('Licencia revocada')
    setUnlocked(false)
    // Delay para que el toast sea visible antes de que el ToastProvider se desmonte
    setTimeout(() => onRevoked(), 1500)
  }

  return (
    <>

      {/* Modal */}
      {unlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
            {password !== PROVIDER_PASSWORD ? (
              <>
                <h4 className="mb-4 text-center text-sm font-semibold text-stone-700">Acceso proveedor</h4>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setError(false); setPassword(e.target.value) }}
                    placeholder="Contraseña"
                    autoFocus
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors ${
                      error
                        ? 'border-red-300 bg-red-50 text-red-900 focus:ring-2 focus:ring-red-100'
                        : 'border-stone-200 bg-stone-50 focus:border-brand-400 focus:ring-2 focus:ring-brand-100'
                    }`}
                  />
                  {error && <p className="text-xs text-red-600">Contraseña incorrecta.</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setUnlocked(false)} className="btn-ghost flex-1 justify-center">
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary flex-1 justify-center">
                      Entrar
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h4 className="mb-1 text-center text-sm font-semibold text-stone-700">Panel de proveedor</h4>
                <p className="mb-5 text-center text-xs text-stone-400">Opciones de administración de licencia</p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleRevoke}
                    className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
                  >
                    Revocar licencia
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUnlocked(false); setPassword('') }}
                    className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-500 transition-colors hover:bg-stone-50"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function formatActivityDate(createdAt: number): string {
  const d = new Date(createdAt)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  if (isToday) {
    return `Hoy, ${time}`
  }
  const date = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${date}, ${time}`
}

interface LicenseInfo {
  status: 'unlicensed' | 'expired' | 'expiring_soon' | 'valid' | 'permanent'
  expires: string | null
  days_left: number | null
}

interface SettingsProps {
  onBack: () => void
  licenseInfo: LicenseInfo | null
  onLicenseActivated: () => void
}

export default function Settings({ onBack, licenseInfo, onLicenseActivated }: SettingsProps) {
  const [config, setConfig] = useState<BackupConfig | null>(null)
  const [canRevert, setCanRevert] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  const [revertingId, setRevertingId] = useState<number | null>(null)
  const [logRetentionDays, setLogRetentionDays] = useState<number>(90)
  const [licenseKey, setLicenseKey] = useState('')
  const [licenseError, setLicenseError] = useState<string | null>(null)
  const [licenseLoading, setLicenseLoading] = useState(false)
  const [appVersion, setAppVersion] = useState<string>('')
  const { toast } = useToast()

  const loadActivityLog = useCallback(() => {
    window.curo.activityLog.list(ACTIVITY_LOG_LIMIT).then(setActivityLog)
  }, [])

  const load = () => {
    window.curo.config.get().then((cfg) => {
      setConfig(cfg)
      setLogRetentionDays(cfg.activityLogRetentionDays)
    })
    window.curo.backup.canRevert().then(setCanRevert)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    window.curo.app.getVersion().then(setAppVersion)
  }, [])

  const handleSelectFolder = async () => {
    const path = await window.curo.config.selectBackupFolder()
    if (path) {
      await window.curo.config.set({ backupPath: path })
      load()
      toast('Ruta de respaldos actualizada')
    }
  }

  const handleBackupsEnabled = async (enabled: boolean) => {
    if (!enabled) {
      const aviso =
        'Al desactivar los respaldos automáticos, dejarán de generarse copias de seguridad de su información de forma automática. Los respaldos manuales continuarán disponibles.\n\nEsta medida puede impactar la protección y recuperación de su información.\n\n¿Desea desactivar los respaldos automáticos?'
      if (!window.confirm(aviso)) return
    }
    await window.curo.config.set({ backupsEnabled: enabled })
    setConfig((c) => (c ? { ...c, backupsEnabled: enabled } : null))
    toast(enabled ? 'Respaldos automáticos activados' : 'Respaldos automáticos desactivados')
  }

  const handleRetentionDays = async (value: number) => {
    const n = Math.max(10, Math.min(365, value))
    await window.curo.config.set({ retentionDays: n })
    setConfig((c) => (c ? { ...c, retentionDays: n } : null))
  }

  const handleMaxPerDay = async (value: number) => {
    const n = Math.max(3, Math.min(100, value))
    await window.curo.config.set({ maxBackupsPerDay: n })
    setConfig((c) => (c ? { ...c, maxBackupsPerDay: n } : null))
  }

  const handleLogRetentionDays = async (value: number) => {
    const n = Math.max(10, Math.min(365, value))
    await window.curo.config.set({ activityLogRetentionDays: n })
    setLogRetentionDays(n)
    setConfig((c) => (c ? { ...c, activityLogRetentionDays: n } : null))
  }

  const handleBackupNow = async () => {
    setBackingUp(true)
    const result = await window.curo.backup.runNow()
    setBackingUp(false)
    if (result.success) toast('Respaldo realizado correctamente')
    else toast(result.error || 'Error al respaldar', 'error')
  }

  const handleRestore = async () => {
    const filePath = await window.curo.backup.selectFileForRestore()
    if (!filePath) return
    const hasData = await window.curo.backup.hasData()
    if (hasData) {
      const ok = window.confirm(
        'Hay datos en la base actual.\nSe creará un respaldo automático antes de recuperar.\n\n¿Continuar?'
      )
      if (!ok) return
    }
    setRestoring(true)
    const result = await window.curo.backup.restore(filePath)
    setRestoring(false)
    if (result.success) {
      toast('Recuperación completada exitosamente')
      setCanRevert(true)
    } else {
      toast(result.error || 'Error al recuperar', 'error')
    }
  }

  const handleRevertRecovery = async () => {
    if (
      !window.confirm(
        'Esto deshará la última recuperación y restaurará su información al estado anterior.\n\n¿Desea continuar?'
      )
    )
      return
    const result = await window.curo.backup.revertRecovery()
    if (result.success) {
      toast('Recuperación revertida exitosamente')
      setCanRevert(false)
    } else {
      toast(result.error || 'Error al revertir', 'error')
    }
  }

  const handleRevertActivity = async (entry: ActivityLogEntry) => {
    if (entry.action === 'deactivate') {
      if (entry.entity_type === null || entry.entity_id === null) return
      if (
        !window.confirm(
          '¿Reactivar este elemento? Volverá a mostrarse en la lista de pacientes o en las consultas del paciente.'
        )
      )
        return
      setRevertingId(entry.id)
      try {
        if (entry.entity_type === 'patient') {
          await window.curo.patients.reactivate(entry.entity_id)
          toast('Paciente reactivado')
        } else if (entry.entity_type === 'consultation') {
          await window.curo.consultations.reactivate(entry.entity_id)
          toast('Consulta reactivada')
        }
        loadActivityLog()
      } catch {
        toast('No se pudo revertir', 'error')
      } finally {
        setRevertingId(null)
      }
    } else if (entry.action === 'update') {
      if (!window.confirm('¿Revertir esta edición? Se restaurará el estado anterior del elemento.')) return
      setRevertingId(entry.id)
      try {
        const result = await window.curo.activityLog.revertUpdate(entry)
        if (result.success) {
          toast('Edición revertida')
          loadActivityLog()
        } else {
          toast(result.error || 'No se pudo revertir', 'error')
        }
      } catch {
        toast('No se pudo revertir', 'error')
      } finally {
        setRevertingId(null)
      }
    }
  }

  const handleLicenseRevoked = () => {
    onLicenseActivated() // refresca el estado en App.tsx
  }

  const formatLicenseInput = (raw: string) => {
    // Siempre limpiar y reformatear desde cero
    const clean = raw.replace(/[^A-Z2-7]/gi, '').toUpperCase().slice(0, 20)

    const groups: string[] = []
    let i = 0
    while (i < clean.length) {
      groups.push(clean.slice(i, i + 5))
      i += 5
    }
    const formatted = groups.join('-')

    // Si el usuario escribió un guión manualmente al final y está justo en un límite de grupo
    // (cada 5 caracteres), preservar el guión trailing para que se vea reflejado
    const rawEndsWithHyphen = raw.endsWith('-')
    const atGroupBoundary = clean.length > 0 && clean.length < 20 && clean.length % 5 === 0
    if (rawEndsWithHyphen && atGroupBoundary) {
      return formatted + '-'
    }

    return formatted
  }

  const handleLicenseActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = licenseKey.replace(/-/g, '')
    if (clean.length !== 20) {
      setLicenseError('La clave debe tener 20 caracteres.')
      return
    }
    setLicenseLoading(true)
    setLicenseError(null)
    const result = await window.curo.license.activate(licenseKey)
    setLicenseLoading(false)
    if (result.ok) {
      toast('Licencia actualizada correctamente')
      setLicenseKey('')
      onLicenseActivated()
    } else {
      setLicenseError(result.error ?? 'Error al activar la clave.')
    }
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-stone-400">Cargando configuración...</p>
      </div>
    )
  }

  const isPermanent = licenseInfo?.status === 'permanent'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back */}
      <button type="button" onClick={onBack} className="btn-ghost -ml-2">
        <IconArrowLeft /> Inicio
      </button>

      <h2
        className="text-xl font-semibold text-stone-800 select-none"
        onDoubleClick={() => document.dispatchEvent(new CustomEvent('provider:open'))}
      >
        Configuración
      </h2>

      {/* ─── Backup Path ─── */}
      <section className="card space-y-4">
        <div className="flex items-center">
          <h3 className="font-semibold text-stone-800">Ruta de respaldos</h3>
          <InfoTooltip text="Carpeta donde se guardarán las copias de seguridad automáticas y manuales de la base de datos." />
        </div>
        <div className="rounded-lg bg-stone-50 px-4 py-3">
          <p className="break-all text-sm text-stone-600">
            {config.backupPath || <span className="italic text-stone-400">No configurada</span>}
          </p>
        </div>
        <button type="button" onClick={handleSelectFolder} className="btn-secondary">
          <IconFolder /> Elegir carpeta
        </button>
      </section>

      {/* ─── Auto Backups ─── */}
      <section className="card space-y-4">
        <div className="flex items-center">
          <h3 className="font-semibold text-stone-800">Respaldos automáticos</h3>
          <InfoTooltip text="Cuando están activos, la aplicación genera copias de seguridad periódicas sin intervención manual. Se conservan los respaldos de los últimos N días, con un máximo de M por día." />
        </div>
        <label className="flex cursor-pointer items-center gap-3">
          <div className="relative">
            <input
              type="checkbox"
              checked={config.backupsEnabled}
              onChange={(e) => handleBackupsEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-6 w-11 rounded-full bg-stone-300 transition-colors peer-checked:bg-brand-600" />
            <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
          </div>
          <span className="text-sm text-stone-700">Permitir copias de seguridad periódicas</span>
        </label>

        <div className="flex flex-wrap items-end gap-6">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">
              Días de respaldo
            </label>
            <input
              type="number"
              min={10}
              max={365}
              value={config.retentionDays}
              onChange={(e) => handleRetentionDays(parseInt(e.target.value, 10) || 10)}
              onBlur={(e) => handleRetentionDays(parseInt(e.target.value, 10) || 10)}
              className="input-field w-20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">
              Respaldos por día
            </label>
            <input
              type="number"
              min={3}
              max={100}
              value={config.maxBackupsPerDay}
              onChange={(e) => handleMaxPerDay(parseInt(e.target.value, 10) || 3)}
              onBlur={(e) => handleMaxPerDay(parseInt(e.target.value, 10) || 3)}
              className="input-field w-20"
            />
          </div>
        </div>
      </section>

      {/* ─── Manual Backup ─── */}
      <section className="card space-y-4">
        <div className="flex items-center">
          <h3 className="font-semibold text-stone-800">Respaldo manual</h3>
          <InfoTooltip text="Genera una copia de seguridad inmediata de todos los datos. Útil antes de cambios importantes o cuando lo requieras." />
        </div>
        <p className="text-sm text-stone-500">Crea una copia de seguridad de su información en este momento.</p>
        <button
          type="button"
          onClick={handleBackupNow}
          disabled={backingUp || !config.backupPath}
          className="btn-primary disabled:opacity-50"
        >
          <IconDownload />
          {backingUp ? 'Respaldando...' : 'Respaldar ahora'}
        </button>
        {!config.backupPath && (
          <p className="text-xs text-amber-600">Configura una ruta de respaldos primero.</p>
        )}
      </section>

      {/* ─── Restore ─── */}
      <section className="card space-y-4">
        <div className="flex items-center">
          <h3 className="font-semibold text-stone-800">Recuperar desde respaldo</h3>
          <InfoTooltip text="Restaura la base de datos desde un archivo de respaldo previo. Si hay datos actuales, se generará un respaldo automático antes de reemplazarlos." />
        </div>
        <p className="text-sm text-stone-500">
          Restaura su información desde un archivo de respaldo seleccionado.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRestore}
            disabled={restoring}
            className="btn-secondary disabled:opacity-50"
          >
            <IconUpload />
            {restoring ? 'Recuperando...' : 'Seleccionar archivo'}
          </button>
          {canRevert && (
            <button
              type="button"
              onClick={handleRevertRecovery}
              className="btn inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1"
            >
              <IconUndo />
              Revertir recuperación
            </button>
          )}
        </div>
      </section>

      {/* ─── Licencia ─── */}
      <section className="card space-y-4">
        <div className="flex items-center">
          <h3 className="font-semibold text-stone-800">Licencia</h3>
          <InfoTooltip text={isPermanent ? 'Tu licencia es permanente y no requiere renovación.' : 'Ingresa una clave de activación para mantener el acceso. Si ya tienes una licencia activa, la nueva clave sumará los días restantes.'} />
        </div>

        {licenseInfo && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${
            isPermanent
              ? 'border-brand-200 bg-brand-50 text-brand-800'
              : licenseInfo.status === 'valid'
              ? 'border-stone-200 bg-stone-50 text-stone-700'
              : licenseInfo.status === 'expiring_soon'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}>
            {isPermanent && 'Licencia permanente activa.'}
            {licenseInfo.status === 'valid' && licenseInfo.expires && (
              <>Vigente hasta <strong>{licenseInfo.expires}</strong>.</>
            )}
            {licenseInfo.status === 'expiring_soon' && licenseInfo.expires && licenseInfo.days_left !== null && (
              <>
                Vence el <strong>{licenseInfo.expires}</strong>{' '}
                ({licenseInfo.days_left === 0 ? 'vence hoy' : `${licenseInfo.days_left} días restantes`}).
              </>
            )}
            {licenseInfo.status === 'expired' && 'La licencia ha vencido.'}
            {licenseInfo.status === 'unlicensed' && 'Sin licencia activa.'}
          </div>
        )}

        {!isPermanent && (
          <form onSubmit={handleLicenseActivate} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">
                Nueva clave de activación
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => {
                  setLicenseError(null)
                  setLicenseKey(formatLicenseInput(e.target.value))
                }}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                spellCheck={false}
                autoComplete="off"
                className={`w-full rounded-xl border px-4 py-2.5 text-center font-mono text-sm tracking-widest outline-none transition-colors ${
                  licenseError
                    ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                    : 'border-stone-200 bg-white text-stone-900 focus:border-brand-400 focus:ring-2 focus:ring-brand-100'
                }`}
              />
              {licenseError && <p className="mt-1.5 text-sm text-red-600">{licenseError}</p>}
            </div>
            <button
              type="submit"
              disabled={licenseLoading || licenseKey.replace(/-/g, '').length < 20}
              className="btn-primary disabled:opacity-50"
            >
              <IconKey />
              {licenseLoading ? 'Verificando…' : 'Activar clave'}
            </button>
          </form>
        )}
      </section>

      {/* ─── Opciones avanzadas ─── */}
      <section className="card space-y-4">
        <div className="flex items-center">
          <h3 className="font-semibold text-stone-800">Opciones avanzadas</h3>
          <InfoTooltip text="Bitácora de actividad del sistema y configuración avanzada. Permite revisar y revertir cambios recientes, y ajustar cuánto tiempo se conservan los registros." />
        </div>
        <p className="text-sm text-stone-500">
          Bitácora de actividad y configuración avanzada del sistema.
        </p>

        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">
            Conservar bitácora (días)
          </label>
          <input
            type="number"
            min={10}
            max={365}
            value={logRetentionDays}
            onChange={(e) => handleLogRetentionDays(parseInt(e.target.value, 10) || 10)}
            onBlur={(e) => handleLogRetentionDays(parseInt(e.target.value, 10) || 10)}
            className="input-field w-20"
          />
          <p className="mt-2 text-xs text-stone-500">
            Los registros de actividad más antiguos se eliminan automáticamente al iniciar la aplicación.
          </p>
        </div>

        {!showActivityLog ? (
          <button
            type="button"
            onClick={() => {
              setShowActivityLog(true)
              loadActivityLog()
            }}
            className="btn-secondary"
          >
            <IconHistory /> Ver bitácora de actividad
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-stone-600">Últimas acciones</span>
              <button
                type="button"
                onClick={() => setShowActivityLog(false)}
                className="text-sm text-stone-500 hover:text-stone-700"
              >
                Ocultar
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto rounded-lg border border-stone-200 bg-stone-50/50">
              {activityLog.length === 0 ? (
                <p className="p-4 text-center text-sm text-stone-400">No hay registros.</p>
              ) : (
                <ul className="divide-y divide-stone-200">
                  {activityLog.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-stone-500">{formatActivityDate(entry.created_at)}</span>
                        <span className="ml-2 text-stone-700">{entry.description}</span>
                      </div>
                      {entry.revertible && (
                        <button
                          type="button"
                          onClick={() => handleRevertActivity(entry)}
                          disabled={revertingId === entry.id}
                          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50"
                        >
                          {revertingId === entry.id ? '...' : entry.action === 'update' ? 'Revertir' : 'Reactivar'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {appVersion && (
        <p className="text-center text-xs text-stone-400">Versión {appVersion}</p>
      )}

      {/* Panel de proveedor (oculto, activado con 5 clics en esquina inferior derecha) */}
      <ProviderPanel onRevoked={handleLicenseRevoked} />
    </div>
  )
}
