import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

const keySets = new Map<string, JWTVerifyGetKey>()

export function workosKeys(clientId: string) {
  let keys = keySets.get(clientId)
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`https://api.workos.com/sso/jwks/${clientId}`))
    keySets.set(clientId, keys)
  }
  return keys
}

export const workosIssuer = (clientId: string) => `https://api.workos.com/user_management/${clientId}`

/** The signed-in user's WorkOS id, or null when the request has no valid access token. */
export async function authenticate(request: Request, keys: JWTVerifyGetKey, issuer: string) {
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1]
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, keys, { issuer })
    return payload.sub ?? null
  } catch {
    return null
  }
}
