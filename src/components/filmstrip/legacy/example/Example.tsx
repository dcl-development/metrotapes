'use client'

import { useState } from 'react'
import Filmstrip, { type FilmStripMode } from '../Filmstrip'
import { sampleFrames } from './placeholders'

const MODES: FilmStripMode[] = ['auto', '3d', 'flat']

/**
 * Drop-in usage. `auto` is the production behavior: 3D when the browser can
 * do preserve-3d, otherwise the flat strip. The buttons force either mode.
 */
export default function FilmstripExample() {
  const [mode, setMode] = useState<FilmStripMode>('auto')

  return (
    <div style={{ background: '#f6f3ec', color: '#1a1a1a', minHeight: '100vh', fontFamily: 'Helvetica, Arial, sans-serif' }}>
      <div style={{ display: 'flex', gap: 8, padding: 16, alignItems: 'center' }}>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, letterSpacing: '0.14em' }}>MODE</span>
        {MODES.map((next) => (
          <button
            key={next}
            type="button"
            aria-pressed={mode === next}
            onClick={() => setMode(next)}
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 12,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '6px 10px',
              border: '1px solid #1a1a1a',
              background: mode === next ? '#f5c518' : 'transparent',
              cursor: 'pointer',
            }}
          >
            {next}
          </button>
        ))}
      </div>
      <Filmstrip images={sampleFrames()} mode={mode} entrance ariaLabel="Sample photo filmstrip" />
    </div>
  )
}
