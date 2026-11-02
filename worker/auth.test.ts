// @vitest-environment node
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'

import { authenticate } from './auth'

const { publicKey, privateKey } = await generateKeyPair('RS256')
const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'test', alg: 'RS256' }] })

function sign(claims: { iss?: string; exp?: string }) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setSubject('user_test')
    .setIssuer(claims.iss ?? 'https://api.workos.com')
    .setIssuedAt()
    .setExpirationTime(claims.exp ?? '5m')
    .sign(privateKey)
}

const withToken = (token?: string) =>
  new Request('https://example.test/joyo/api/onboarding/result', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

describe('authenticate', () => {
  it('returns the user id from a valid WorkOS access token', async () => {
    expect(await authenticate(withToken(await sign({})), keys)).toBe('user_test')
  })

  it('rejects missing, foreign and expired tokens', async () => {
    expect(await authenticate(withToken(), keys)).toBeNull()
    expect(await authenticate(withToken(await sign({ iss: 'https://evil.test' })), keys)).toBeNull()
    expect(await authenticate(withToken(await sign({ exp: '1 minute ago' })), keys)).toBeNull()
  })
})
