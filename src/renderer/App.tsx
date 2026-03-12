import { useState, useCallback, useEffect } from 'react'
import PatientList from './components/PatientList'
import PatientForm from './components/PatientForm'
import PatientDetail from './components/PatientDetail'
import Settings from './components/Settings'
import ActivationScreen from './components/ActivationScreen'
import LicenseIndicator from './components/LicenseIndicator'
import { ToastProvider, useToast } from './components/Toast'
import { IconGear, IconLogOut } from './components/Icons'

type View = 'list' | 'new-patient' | 'patient-detail' | 'settings'

interface LicenseInfo {
  status: 'unlicensed' | 'expired' | 'expiring_soon' | 'valid' | 'permanent'
  expires: string | null
  days_left: number | null
}

let hasShownPendingError = false
let hasShownLicenseToast = false

function PendingBackupErrorNotifier() {
  const { toast } = useToast()
  useEffect(() => {
    if (hasShownPendingError) return
    window.curo.config.get().then((cfg) => {
      if (!cfg.backupsEnabled) return
      window.curo.backup.getPendingError().then((err) => {
        if (err && !hasShownPendingError) {
          hasShownPendingError = true
          toast(
            'El último respaldo no se completó debido a un error.\nSe recomienda generar un respaldo manual para asegurar la información.',
            'error'
          )
          window.curo.backup.clearPendingError()
        }
      })
    })
  }, [toast])
  return null
}

function LicenseExpiryToast({ info }: { info: LicenseInfo | null }) {
  const { toast } = useToast()
  useEffect(() => {
    if (hasShownLicenseToast) return
    if (!info) return
    if (info.status === 'expiring_soon' && info.days_left !== null) {
      hasShownLicenseToast = true
      toast(
        `Tu licencia vence en ${info.days_left} día${info.days_left === 1 ? '' : 's'}. Puedes renovarla desde Configuración.`,
        'error'
      )
    }
  }, [info, toast])
  return null
}

function App() {
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null)
  const [clientName, setClientName] = useState<string>('Curo')
  const [view, setView] = useState<View>('list')
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null)
  const [listRefresh, setListRefresh] = useState(0)

  // Obtener nombre del cliente desde el build
  useEffect(() => {
    window.curo.app.getClientName().then(setClientName)
  }, [])

  // Suscribirse al canal license:status (main → renderer)
  useEffect(() => {
    const unsub = window.curo.license.onStatus((info) => {
      setLicenseInfo(info)
    })
    // Pedir el estado actual por si el evento ya llegó antes del render
    window.curo.license.check().then(setLicenseInfo)
    return unsub
  }, [])

  const goToList = useCallback(() => {
    setView('list')
    setSelectedPatientId(null)
    setListRefresh((r) => r + 1)
  }, [])

  const openPatientDetail = useCallback((id: number) => {
    setSelectedPatientId(id)
    setView('patient-detail')
  }, [])

  const handleNewPatientSaved = useCallback(
    (newPatientId?: number) => {
      if (newPatientId) {
        openPatientDetail(newPatientId)
      } else {
        goToList()
      }
    },
    [openPatientDetail, goToList]
  )

  const handleActivated = useCallback(() => {
    window.curo.license.check().then((info) => {
      setLicenseInfo(info)
    })
  }, [])

  // Pantalla de carga mientras verificamos licencia
  if (licenseInfo === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-sm text-stone-400">Iniciando…</p>
      </div>
    )
  }

  const needsActivation =
    licenseInfo.status === 'unlicensed' || licenseInfo.status === 'expired'

  // Pantalla de activación si la licencia no es válida
  if (needsActivation) {
    return (
      <ToastProvider>
        <ActivationScreen
          onActivated={handleActivated}
          expired={licenseInfo.status === 'expired'}
        />
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <PendingBackupErrorNotifier />
      <LicenseExpiryToast info={licenseInfo} />
      <div className="flex min-h-screen flex-col bg-stone-50">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/80 backdrop-blur-md">
          <div className="flex items-center justify-between px-6 py-3">
            <button
              type="button"
              onClick={goToList}
              className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
            >
              <img
                src={`${import.meta.env.BASE_URL}Logo.png`}
                alt=""
                className="h-8 w-8 shrink-0 rounded-lg object-contain"
              />
              <span className="text-lg font-semibold tracking-tight text-stone-800">
                {clientName}
              </span>
            </button>

            <div className="flex items-center gap-0.5">
              <LicenseIndicator
                info={licenseInfo}
                onClick={() => setView('settings')}
              />
              <button
                type="button"
                onClick={() => setView('settings')}
                className={`rounded-lg p-2 transition-colors ${
                  view === 'settings'
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'
                }`}
                title="Configuración"
              >
                <IconGear />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('¿Está seguro de que desea salir de la aplicación?')) {
                    window.curo.app.quit()
                  }
                }}
                className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                title="Salir"
              >
                <IconLogOut />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-6 py-6">
          <div className="mx-auto max-w-5xl">
            {view === 'list' && (
              <PatientList
                onSelectPatient={openPatientDetail}
                onNewPatient={() => setView('new-patient')}
                onRefresh={listRefresh}
              />
            )}

            {view === 'new-patient' && (
              <div className="mx-auto max-w-2xl">
                <h2 className="mb-6 text-xl font-semibold text-stone-800">Nuevo paciente</h2>
                <PatientForm
                  patientId={null}
                  onSaved={handleNewPatientSaved}
                  onCancel={goToList}
                />
              </div>
            )}

            {view === 'patient-detail' && selectedPatientId !== null && (
              <PatientDetail patientId={selectedPatientId} onBack={goToList} />
            )}

            {view === 'settings' && (
              <Settings
                onBack={goToList}
                licenseInfo={licenseInfo}
                onLicenseActivated={handleActivated}
              />
            )}
          </div>
        </main>
      </div>
    </ToastProvider>
  )
}

export default App
