import { useCallback, useEffect, useRef, useState } from 'react'
import { ASSISTANT_NAME, BRIDGE_HTTP_URL } from '../config'

/**
 * Pick the assistant's voice from the ElevenLabs voices on your account.
 *
 * Press V to open. Click a voice to hear a sample, then "usar" to keep it; the
 * choice is saved by the bridge and survives restarts. The sample goes through
 * the bridge's /tts endpoint, so the API key never reaches the browser.
 */

export const VOICE_PICKER_EVENT = 'atlas:voice-picker'

type VoiceInfo = {
  id: string
  name: string
  category: string
  description: string
  gender: string
  accent: string
}

export function VoicePicker() {
  const [open, setOpen] = useState(false)
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [current, setCurrent] = useState('')
  const [status, setStatus] = useState('')
  const audio = useRef<HTMLAudioElement | null>(null)

  const load = useCallback(async () => {
    setStatus('Cargando voces…')
    try {
      const res = await fetch(`${BRIDGE_HTTP_URL}/voices`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = (await res.json()) as { current: string; voices: VoiceInfo[] }
      setVoices(data.voices)
      setCurrent(data.current)
      setStatus(data.voices.length ? '' : 'No hay voces en tu cuenta de ElevenLabs.')
    } catch {
      setStatus('No pude cargar las voces. ¿Está la clave de ElevenLabs configurada?')
    }
  }, [])

  useEffect(() => {
    const toggle = () => setOpen((o) => !o)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener(VOICE_PICKER_EVENT, toggle)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener(VOICE_PICKER_EVENT, toggle)
      window.removeEventListener('keydown', esc)
    }
  }, [])

  useEffect(() => {
    if (open) void load()
    else audio.current?.pause()
  }, [open, load])

  const preview = async (v: VoiceInfo) => {
    setStatus(`Probando ${v.name}…`)
    try {
      const res = await fetch(`${BRIDGE_HTTP_URL}/tts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: `Hola, soy ${ASSISTANT_NAME}. ¿En qué te ayudo hoy?`,
          voiceId: v.id,
        }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const url = URL.createObjectURL(await res.blob())
      audio.current?.pause()
      const a = new Audio(url)
      audio.current = a
      a.onended = () => URL.revokeObjectURL(url)
      await a.play()
      setStatus('')
    } catch {
      setStatus('No pude reproducir la muestra.')
    }
  }

  const choose = async (v: VoiceInfo) => {
    try {
      const res = await fetch(`${BRIDGE_HTTP_URL}/voice`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: v.id }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      setCurrent(v.id)
      setStatus(`Voz guardada: ${v.name}`)
    } catch {
      setStatus('No pude guardar la voz.')
    }
  }

  if (!open) return null

  return (
    <div className="vp">
      <div className="vp-head">VOZ DE {ASSISTANT_NAME.toUpperCase()} · V o Esc para cerrar</div>
      {status && <div className="vp-status">{status}</div>}
      <ul className="vp-list">
        {voices.map((v) => (
          <li key={v.id} className={v.id === current ? 'vp-row vp-on' : 'vp-row'}>
            <span className="vp-name">
              {v.name}
              <small>{[v.gender, v.accent, v.description].filter(Boolean).join(' · ')}</small>
            </span>
            <button type="button" onClick={() => void preview(v)}>
              probar
            </button>
            <button type="button" onClick={() => void choose(v)} disabled={v.id === current}>
              {v.id === current ? 'en uso' : 'usar'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
