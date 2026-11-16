'use client'
// Dialog host: shows the dialog named by store.dialog. Each dialog is its own file here and returns null unless it is the active one.
import LoginDialog from './LoginDialog'
import SettingsDialog from './SettingsDialog'
import DepositDialog from './DepositDialog'
import WithdrawDialog from './WithdrawDialog'
import CompareDialog from './CompareDialog'
import ConfirmDialog from './ConfirmDialog'
import CloseDialog from './CloseDialog'
import CloseAllDialog from './CloseAllDialog'
import ShareDialog from './ShareDialog'
import TpslDialog from './TpslDialog'
import { useApp } from '@/lib/store'
import { useEscape } from '@/lib/presence'
export default function Dialogs() {
  const { dialog, closeDialog } = useApp()
  useEscape(!!dialog, closeDialog) // Esc closes whichever dialog is open
  return <><LoginDialog /><SettingsDialog /><DepositDialog /><WithdrawDialog /><CompareDialog /><ConfirmDialog /><CloseDialog /><CloseAllDialog /><ShareDialog /><TpslDialog /></>
}
