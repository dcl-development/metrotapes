import { gzipSync } from 'node:zlib'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const dir = path.resolve('dist/assets')
const files = readdirSync(dir).filter((name) => name.endsWith('.js'))
const rows = files.map((name) => {
  const raw = readFileSync(path.join(dir, name))
  return { name, raw: raw.length, gz: gzipSync(raw).length }
}).sort((a, b) => b.gz - a.gz)

const kib = (n) => (n / 1024).toFixed(1)
for (const row of rows) {
  console.log(`${kib(row.gz).padStart(7)} KiB gzip  ${kib(row.raw).padStart(7)} KiB  ${row.name}`)
}

function sum(pred) {
  return rows.filter(pred).reduce((total, row) => total + row.gz, 0)
}

const three = sum((row) => row.name.includes('three'))
const post = sum((row) => row.name.includes('postprocessing'))
const app = sum((row) => !row.name.includes('three') && !row.name.includes('postprocessing'))

// Phase 1 gzip: three ~191 KiB, postprocessing ~16 KiB, app js ~225 KiB.
// Phase 2 measured: three 190.9, postprocessing 15.6, app js 236.2
// (index, station, rat, steam, bloom, sanity). Caps sit about 12% above that.
const limits = {
  three: 215 * 1024,
  post: 20 * 1024,
  app: 265 * 1024,
}

console.log(`totals  three ${kib(three)}  post ${kib(post)}  app ${kib(app)} KiB gzip`)

const failures = []
if (three > limits.three) failures.push(`three ${kib(three)} KiB > ${kib(limits.three)} KiB`)
if (post > limits.post) failures.push(`postprocessing ${kib(post)} KiB > ${kib(limits.post)} KiB`)
if (app > limits.app) failures.push(`app js ${kib(app)} KiB > ${kib(limits.app)} KiB`)
if (!statSync(dir).isDirectory()) failures.push('missing dist/assets')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
