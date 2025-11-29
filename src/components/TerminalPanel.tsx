import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { authService } from '../authService'

type Props = {
  clientId: string
}

const TerminalPanel: React.FC<Props> = ({ clientId }) => {
  const xtermRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef<number>(0)
  const [terminalStatus, setTerminalStatus] = useState<'idle'|'connecting'|'connected'|'disconnected'>('idle')
  const [terminalError, setTerminalError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [autoReconnect, setAutoReconnect] = useState(false)

  const ensureXterm = () => {
    let term = xtermRef.current
    if (!term && typeof window !== 'undefined') {
      term = new Terminal({ cols: 80, rows: 24, convertEol: true })
      const fit = new FitAddon()
      term.loadAddon(fit)
      const container = document.getElementById('xterm-container') as HTMLDivElement | null
      if (container) {
        term.open(container)
        fit.fit()
      }
      xtermRef.current = term
      fitRef.current = fit
      term.onData((d: string) => {
        try {
          const ws = wsRef.current
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              const enc = new TextEncoder()
              const buf = enc.encode(d)
              ws.send(buf.buffer)
            } catch (err) {
              try { ws.send(d) } catch (e) { void e }
            }
          }
        } catch (err) { console.error('xterm send error', err) }
      })
      const onWinResize = () => {
        try {
          fitRef.current?.fit()
          const cols = term?.cols || 80
          const rows = term?.rows || 24
          const ws = wsRef.current
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols, rows }))
          }
        } catch (err) { void err }
      }
      window.addEventListener('resize', onWinResize)
      ;(term as any).__onWinResize = onWinResize
    }
    return xtermRef.current
  }

  const attachWebSocket = (url: string) => {
    try { if (wsRef.current) { wsRef.current.close() } } catch (e) { void e }
    const ws = new WebSocket(url)
    wsRef.current = ws
    try { ws.binaryType = 'arraybuffer' } catch (err) { void err }

    ws.onopen = () => {
      setTerminalStatus('connected')
      setTerminalError(null)
      retryCountRef.current = 0
      const term = xtermRef.current
      if (term) {
        try { term.clear() } catch (err) { void err }
        try { term.focus() } catch (err) { void err }
        try { fitRef.current?.fit() } catch (err) { void err }
        try {
          const cols = term.cols || 80
          const rows = term.rows || 24
          ws.send(JSON.stringify({ type: 'resize', cols, rows }))
        } catch (err) { void err }
      }
    }

    ws.onmessage = async (ev) => {
      try {
        if (typeof ev.data === 'string') {
          try { const j = JSON.parse(ev.data); if (j && j.type === 'session.unknown') { setTerminalStatus('disconnected'); setTerminalError(j.message || 'Session not present on agent') } } catch (e) { void e }
        } else if (ev.data instanceof ArrayBuffer) {
          xtermRef.current?.write(new TextDecoder().decode(new Uint8Array(ev.data)))
        } else if (ev.data instanceof Blob) {
          const ab = await ev.data.arrayBuffer()
          xtermRef.current?.write(new TextDecoder().decode(new Uint8Array(ab)))
        }
      } catch (e) { console.error('Failed to handle ws msg', e) }
    }

    ws.onclose = () => {
      setTerminalStatus('disconnected')
      setTerminalError('WebSocket closed')
      if (autoReconnect && sessionId) scheduleReconnect()
    }

    ws.onerror = () => {
      setTerminalStatus('disconnected')
      setTerminalError('WebSocket error')
      if (autoReconnect && sessionId) scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    if (reconnectTimerRef.current) return
    const retry = retryCountRef.current
    const base = Math.min(30, Math.pow(2, retry)) * 1000
    const jitter = Math.floor(Math.random() * 1000)
    const delay = Math.min(30000, base + jitter)
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null
      retryCountRef.current = Math.min(10, retryCountRef.current + 1)
      attemptReconnect()
    }, delay)
  }

  const attemptReconnect = async () => {
    if (!sessionId) return
    try {
      setTerminalStatus('connecting')
      ensureXterm()
      const token = authService.getToken()
      const tokenParam = token ? `?token=${encodeURIComponent(`Bearer ${token}`)}` : ''
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/terminal/${sessionId}${tokenParam}`
      attachWebSocket(wsUrl)
    } catch (e) {
      console.error('attemptReconnect failed', e)
      scheduleReconnect()
    }
  }

  const startNewSessionAndAttach = async () => {
    const headers = { 'Content-Type': 'application/json', ...authService.getAuthHeaders() }
    const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/terminal/start`, { method: 'POST', headers })
    if (!res.ok) throw new Error(`Error ${res.status}`)
    const data = await res.json()
    const sid = data.session_id as string | undefined
    if (!sid) throw new Error('No session_id')
    setSessionId(sid)
    ensureXterm()
    const token = authService.getToken()
    const tokenParam = token ? `?token=${encodeURIComponent(`Bearer ${token}`)}` : ''
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/terminal/${sid}${tokenParam}`
    attachWebSocket(wsUrl)
  }

  useEffect(() => {
    return () => {
      try {
        if (wsRef.current) {
          try { wsRef.current.close() } catch (err) { void err }
          wsRef.current = null
        }
        if (xtermRef.current) {
          try { xtermRef.current.dispose() } catch (err) { void err }
          xtermRef.current = null
        }
        if (fitRef.current) {
          try { if ((fitRef.current as any).dispose) (fitRef.current as any).dispose() } catch (err) { void err }
          fitRef.current = null
        }
      } catch (err) { void err }
    }
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={async () => { setTerminalError(null); setTerminalStatus('connecting'); try { await startNewSessionAndAttach(); alert('Terminal session started') } catch (e) { setTerminalStatus('disconnected'); setTerminalError(String(e)) } }}>Open Terminal</button>
        <button onClick={async () => {
          if (!sessionId) { alert('No session to reconnect'); return }
          setTerminalStatus('connecting'); setTerminalError(null); try { ensureXterm(); const token = authService.getToken(); const tokenParam = token ? `?token=${encodeURIComponent(`Bearer ${token}`)}` : ''; const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/terminal/${sessionId}${tokenParam}`; attachWebSocket(wsUrl) } catch (e) { setTerminalStatus('disconnected'); setTerminalError(String(e)) }
        }}>Reconnect</button>
        <label style={{ marginLeft: 8 }}>
          <input type="checkbox" checked={autoReconnect} onChange={(e) => setAutoReconnect(e.target.checked)} /> Auto Reconnect
        </label>
        <div style={{ marginLeft: 'auto' }}><strong>Terminal:</strong> {terminalStatus}</div>
      </div>
      {terminalError && <div style={{ marginTop: 8, color: 'darkorange' }}>{terminalError}</div>}
      <div id="xterm-container" style={{ width: '100%', height: 360, background: '#000', marginTop: 8 }} />
    </div>
  )
}

export default TerminalPanel
