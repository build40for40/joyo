import { createClient } from '@workos-inc/authkit-js'

/** Public WorkOS client id. Keep it in step with `WORKOS_CLIENT_ID` in wrangler.jsonc. */
export const WORKOS_CLIENT_ID = ''

let client: ReturnType<typeof createClient> | undefined

export function getAuth() {
  client ??= createClient(WORKOS_CLIENT_ID, {
    redirectUri: new URL(import.meta.env.BASE_URL, window.location.origin).href,
    onRedirectCallback: () => window.history.replaceState(null, '', import.meta.env.BASE_URL),
  }).catch((error: unknown) => {
    client = undefined
    throw error
  })
  return client
}
