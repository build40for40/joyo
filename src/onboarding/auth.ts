import { createClient } from '@workos-inc/authkit-js'

import { workosClientId } from './workos'

let client: ReturnType<typeof createClient> | undefined

export function getAuth() {
  client ??= createClient(workosClientId(window.location.hostname), {
    redirectUri: new URL(import.meta.env.BASE_URL, window.location.origin).href,
    // Without a custom auth domain the refresh cookie on api.workos.com is third-party and blocked, so keep the refresh token in localStorage.
    devMode: true,
    onRedirectCallback: () => window.history.replaceState(null, '', import.meta.env.BASE_URL),
  }).catch((error: unknown) => {
    client = undefined
    throw error
  })
  return client
}
