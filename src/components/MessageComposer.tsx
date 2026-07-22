import { Gift, Plus, Smile, Sticker } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../state/store'

export function MessageComposer({ placeholder }: { placeholder: string }) {
  const { sendMessage, mode } = useStore()
  const [value, setValue] = useState('')

  function submit() {
    const t = value.trim()
    if (!t) return
    sendMessage(t)
    setValue('')
  }

  return (
    <div className="composer">
      <div className="composer-inner">
        <button className="cp-add" title="Ajouter">
          <Plus size={18} />
        </button>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={placeholder}
          aria-label="Message"
        />
        <div className="cp-actions">
          <Gift size={22} />
          <Sticker size={22} />
          <Smile size={22} />
        </div>
      </div>
      {mode === 'demo' && (
        <div className="composer-note">
          Mode demo — les messages restent en local et ne sont pas envoyes.
        </div>
      )}
    </div>
  )
}
