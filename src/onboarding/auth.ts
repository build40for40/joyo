import { createClient } from '@workos-inc/authkit-js'

import { isProductionHost, workosClientId } from './workos'

let client: ReturnType<typeof createClient> | undefined

export function getAuth() {
  const { hostname } = window.location
  client ??= createClient(workosClientId(hostname), {
    redirectUri: new URL(import.meta.env.BASE_URL, window.location.origin).href,
    // Staging has no custom auth domain, so the refresh cookie on api.workos.com would be third-party and blocked.
    devMode: !isProductionHost(hostname),
    onRedirectCallback: () => window.history.replaceState(null, '', import.meta.env.BASE_URL),
  }).catch((error: unknown) => {
    client = undefined
    throw error
  })
  return client
}
