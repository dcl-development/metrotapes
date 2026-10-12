import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { applyRouteMeta, canonicalUrl, pageForPath } from './routeMeta.js'

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')

test('photo html carries its own title, description, canonical, and social tags', () => {
  const photo = applyRouteMeta(html, '/photo')
  assert.match(photo, /<title>photo · metrotapes<\/title>/)
  assert.match(photo, /content="Photographs by Ronnie Foreman \/ metrotapes\."/)
  assert.match(photo, /<link rel="canonical" href="https:\/\/metrotapes\.com\/photo" \/>/)
  assert.match(photo, /property="og:url" content="https:\/\/metrotapes\.com\/photo"/)
  assert.match(photo, /property="og:title" content="photo · metrotapes"/)
  assert.match(photo, /name="twitter:title" content="photo · metrotapes"/)
  assert.match(photo, /name="twitter:description" content="Photographs by Ronnie Foreman \/ metrotapes\."/)
  assert.doesNotMatch(photo, /href="https:\/\/metrotapes\.com\/"/)
  assert.doesNotMatch(photo, /content="https:\/\/metrotapes\.com\/"/)
})

test('applying a second route replaces the first', () => {
  const video = applyRouteMeta(applyRouteMeta(html, '/photo'), '/video')
  assert.match(video, /<title>video · metrotapes<\/title>/)
  assert.match(video, /href="https:\/\/metrotapes\.com\/video"/)
  assert.doesNotMatch(video, /photo · metrotapes/)
})

test('blog is noindex and about keeps its description', () => {
  const blog = applyRouteMeta(html, '/blog')
  assert.match(blog, /name="robots" content="noindex, nofollow"/)
  assert.match(blog, /href="https:\/\/metrotapes\.com\/blog"/)
  const about = applyRouteMeta(html, '/about')
  assert.match(about, /<title>about · metrotapes<\/title>/)
  assert.match(about, /videographer in the New York metropolitan area/)
})

test('home canonical stays the site root', () => {
  assert.equal(canonicalUrl('/'), 'https://metrotapes.com/')
  assert.equal(pageForPath('/photo/').path, '/photo')
  const home = applyRouteMeta(html, '/')
  assert.match(home, /<link rel="canonical" href="https:\/\/metrotapes\.com\/" \/>/)
  assert.match(home, /Skate, snow, and other visual work\./)
})
