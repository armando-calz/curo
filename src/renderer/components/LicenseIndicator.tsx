import { IconKey } from './Icons'

interface LicenseInfo {
  status: 'unlicensed' | 'expired' | 'expiring_soon' | 'valid' | 'permanent'
  expires: string | null
  days_left: number | null
}

interface Props {
  info: LicenseInfo | null
  onClick: () => void
}

export default function LicenseIndicator({ info, onClick }: Props) {
  if (!info || info.status === 'valid' || info.status === 'permanent') return null

  const label =
    info.status === 'expiring_soon' && info.days_left !== null
      ? `Licencia expira en ${info.days_left}d`
      : 'Licencia vencida'

  const colorClass =
    info.status === 'expired'
      ? 'text-red-600 hover:bg-red-50'
      : 'text-amber-600 hover:bg-amber-50'

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${colorClass}`}
    >
      <IconKey className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  )
}
