import { createClient } from '@workos-inc/authkit-js'

import { workosClientId } from './workos'

let client: ReturnType<typeof createClient> | undefined

const FAKE_SIGNED_IN = 'joyo:fake-signed-in'

/** `npm run fake` signs in without WorkOS. Production builds drop this branch. */
const fakeClient = {
  getUser: () => (sessionStorage.getItem(FAKE_SIGNED_IN) ? { id: 'user_local' } : null),
  getAccessToken: async () => 'fake-token',
  signIn: async () => {
    sessionStorage.setItem(FAKE_SIGNED_IN, 'true')
    window.location.reload()
  },
}

export function getAuth() {
  if (import.meta.env.MODE === 'fake')
    return (client ??= Promise.resolve(fakeClient as unknown as Awaited<ReturnType<typeof createClient>>))

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
