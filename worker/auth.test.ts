// @vitest-environment node
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'

import { authenticate, workosIssuer } from './auth'

const { publicKey, privateKey } = await generateKeyPair('RS256')
const issuer = workosIssuer('client_test')
const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'test', alg: 'RS256' }] })

function sign(claims: { iss?: string; exp?: string }) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setSubject('user_test')
    .setIssuer(claims.iss ?? issuer)
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
    expect(await authenticate(withToken(await sign({})), keys, issuer)).toBe('user_test')
  })

  it('rejects missing, foreign and expired tokens', async () => {
    expect(await authenticate(withToken(), keys, issuer)).toBeNull()
    expect(await authenticate(withToken(await sign({ iss: workosIssuer('client_other') })), keys, issuer)).toBeNull()
    expect(await authenticate(withToken(await sign({ exp: '1 minute ago' })), keys, issuer)).toBeNull()
  })
})
