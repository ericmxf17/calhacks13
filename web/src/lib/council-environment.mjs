// SDK env overrides merge with process.env. Shadow inherited credentials,
// then supply OS plumbing and an explicit shell for Droid's startup resolver.
/** @param {string} apiKey @param {string} home @returns {Record<string, string>} */
export function councilEnvironment(apiKey, home) {
  const env = Object.fromEntries(Object.keys(process.env).map(name => [name, '']))
  for (const name of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'LANG']) {
    if (process.env[name]) env[name] = process.env[name]
  }
  Object.assign(env, {
    HOME: home, USERPROFILE: home, FACTORY_HOME_OVERRIDE: home, FACTORY_API_KEY: apiKey,
    // An empty SHELL prevents Droid's nullish fallback to COMSPEC/defaults.
    SHELL: process.env.SHELL || process.env.COMSPEC || (process.platform === 'win32' ? `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\cmd.exe` : '/bin/sh'),
  })
  return env
}
