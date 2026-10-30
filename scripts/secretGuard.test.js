import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findLeaks, secretValues } from './secretGuard.js'

describe('secretGuard', () => {
  const env = {
    VITE_SANITY_TOKEN: 'sk-fake-token-value-123456',
    YOUTUBE_API_KEY: 'fake-youtube-key-123456',
    SANITY_DATASET: 'production',
    SHORT_KEY: 'abc',
  }

  it('only picks secret-looking names with real values', () => {
    assert.deepEqual(secretValues(env).map((s) => s.name), ['VITE_SANITY_TOKEN', 'YOUTUBE_API_KEY'])
  })

  it('reports the variable and file, not the value', () => {
    const leaks = findLeaks(env, [
      ['assets/index.js', 'const t = "sk-fake-token-value-123456"'],
      ['assets/clean.js', 'const dataset = "production"'],
    ])
    assert.deepEqual(leaks, [{ name: 'VITE_SANITY_TOKEN', fileName: 'assets/index.js' }])
  })
})
