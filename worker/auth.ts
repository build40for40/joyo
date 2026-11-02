import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

// The WorkOS docs show the issuer both with and without a trailing slash.
const WORKOS_ISSUERS = ['https://api.workos.com', 'https://api.workos.com/']

const keySets = new Map<string, JWTVerifyGetKey>()

export function workosKeys(clientId: string) {
  let keys = keySets.get(clientId)
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`https://api.workos.com/sso/jwks/${clientId}`))
    keySets.set(clientId, keys)
  }
  return keys
}

/** The signed-in user's WorkOS id, or null when the request has no valid access token. */
export async function authenticate(request: Request, keys: JWTVerifyGetKey) {
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1]
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, keys, { issuer: WORKOS_ISSUERS })
    return payload.sub ?? null
  } catch {
    return null
  }
}
