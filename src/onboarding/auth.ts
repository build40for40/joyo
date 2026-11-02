import { createClient } from '@workos-inc/authkit-js'

import { workosClientId } from './workos'

let client: ReturnType<typeof createClient> | undefined

export function getAuth() {
  client ??= createClient(workosClientId(window.location.hostname), {
    redirectUri: new URL(import.meta.env.BASE_URL, window.location.origin).href,
    onRedirectCallback: () => window.history.replaceState(null, '', import.meta.env.BASE_URL),
  }).catch((error: unknown) => {
    client = undefined
    throw error
  })
  return client
}
