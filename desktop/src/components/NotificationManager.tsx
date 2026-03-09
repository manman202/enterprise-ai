import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

interface Props {
  pendingNotification: { title: string; body: string } | null
  onConsumed: () => void
}

/**
 * When the window is hidden/minimized and a new AI response arrives,
 * fire an OS notification via the Tauri notification plugin.
 */
export function NotificationManager({ pendingNotification, onConsumed }: Props) {
  const windowRef = useRef(getCurrentWindow())

  useEffect(() => {
    if (!pendingNotification) return

    async function maybeNotify() {
      const win = windowRef.current
      const visible = await win.isVisible().catch(() => true)
      const focused = await win.isFocused().catch(() => true)

      if (!visible || !focused) {
        await invoke('show_notification', {
          title: pendingNotification!.title,
          body: pendingNotification!.body,
        }).catch(() => {})
      }
      onConsumed()
    }

    maybeNotify()
  }, [pendingNotification, onConsumed])

  return null
}
