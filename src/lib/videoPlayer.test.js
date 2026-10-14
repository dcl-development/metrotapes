import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  postYouTubeCommand,
  shouldArmVideoRequest,
  videoEmbedMounted,
  youtubeEmbedSrc,
} from './videoPlayer.js'

describe('videoEmbedMounted', () => {
  it('keeps the same clip mounted while it is paused on the video page', () => {
    assert.equal(videoEmbedMounted({
      onPage: true,
      sessionId: 'abc',
      videoId: 'abc',
    }), true)
  })

  it('drops the embed when the route actually leaves /video', () => {
    assert.equal(videoEmbedMounted({
      onPage: false,
      sessionId: 'abc',
      videoId: 'abc',
    }), false)
  })

  it('does not treat a poster-only clip as a live player', () => {
    assert.equal(videoEmbedMounted({
      onPage: true,
      sessionId: null,
      videoId: 'abc',
    }), false)
  })
})

describe('youtubeEmbedSrc', () => {
  it('enables the command API without a play-state query that would reload', () => {
    const src = youtubeEmbedSrc('HrYCYJVQ4Vw', 'https://metrotapes.com')
    assert.match(src, /^https:\/\/www\.youtube\.com\/embed\/HrYCYJVQ4Vw\?/)
    assert.match(src, /enablejsapi=1/)
    assert.match(src, /autoplay=1/)
    assert.equal(src.includes('playing'), false)
    assert.match(src, /origin=https%3A%2F%2Fmetrotapes\.com/)
  })
})

describe('shouldArmVideoRequest', () => {
  it('arms a deep link once', () => {
    assert.equal(shouldArmVideoRequest({
      onPage: true,
      status: 'ready',
      requested: 'abc',
      armed: '',
    }), true)
  })

  it('does not re-arm the clip that is already open', () => {
    assert.equal(shouldArmVideoRequest({
      onPage: true,
      status: 'ready',
      requested: 'abc',
      armed: 'abc',
    }), false)
  })

  it('stays quiet off the video page and before the catalog is ready', () => {
    assert.equal(shouldArmVideoRequest({
      onPage: false,
      status: 'ready',
      requested: 'abc',
      armed: '',
    }), false)
    assert.equal(shouldArmVideoRequest({
      onPage: true,
      status: 'loading',
      requested: 'abc',
      armed: '',
    }), false)
  })
})

describe('postYouTubeCommand', () => {
  it('sends pause and play without touching the iframe src', () => {
    const messages = []
    const frame = {
      contentWindow: {
        postMessage(data) { messages.push(data) },
      },
    }
    assert.equal(postYouTubeCommand(frame, 'pauseVideo'), true)
    assert.equal(postYouTubeCommand(frame, 'playVideo'), true)
    assert.deepEqual(messages.map((raw) => JSON.parse(raw).func), ['pauseVideo', 'playVideo'])
  })
})
