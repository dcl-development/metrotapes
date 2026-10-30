/**
 * Build guard: fail the site build if the value of any secret-looking env var
 * (name contains TOKEN, SECRET, KEY or PASSWORD) shows up in the browser bundle.
 * Values are never printed, only the variable name and the file.
 */
const SECRET_NAME = /(TOKEN|SECRET|KEY|PASSWORD)/i
const MIN_LENGTH = 12

export function secretValues(env = {}) {
  return Object.entries(env)
    .filter(([name, value]) => SECRET_NAME.test(name) && typeof value === 'string' && value.length >= MIN_LENGTH)
    .map(([name, value]) => ({ name, value }))
}

export function findLeaks(env, files) {
  const secrets = secretValues(env)
  const leaks = []
  for (const [fileName, code] of files) {
    for (const { name, value } of secrets) {
      if (code.includes(value)) leaks.push({ name, fileName })
    }
  }
  return leaks
}

export function secretGuardPlugin(env) {
  return {
    name: 'secret-guard',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.values(bundle).map((item) => [
        item.fileName,
        item.type === 'chunk' ? item.code : String(item.source ?? ''),
      ])
      const leaks = findLeaks(env, files)
      if (leaks.length) {
        const list = leaks.map((leak) => `${leak.name} in ${leak.fileName}`).join(', ')
        this.error(`Secret value found in the browser bundle: ${list}. Read it on the server instead.`)
      }
    },
  }
}
