import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

// Format: v1:<iv>:<tag>:<ciphertext>, each part base64.
const VERSION = 'v1'

function masterKey() {
  const key = Buffer.from(useRuntimeConfig().masterKey, 'base64')
  if (key.length !== 32) {
    throw new Error('NUXT_MASTER_KEY must be 32 bytes encoded as base64 (openssl rand -base64 32)')
  }
  return key
}

export function encryptWithKey(plain: string, key: Buffer) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join(':')
}

export function decryptWithKey(payload: string, key: Buffer) {
  const [version, iv, tag, data] = payload.split(':')
  if (version !== VERSION || !iv || !tag || data === undefined) {
    throw new Error('Unsupported ciphertext format')
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
}

export function encryptSecret(plain: string) {
  return encryptWithKey(plain, masterKey())
}

export function decryptSecret(payload: string) {
  return decryptWithKey(payload, masterKey())
}

// Key derived from a user passphrase, used for portable exports.
export function deriveKey(passphrase: string, salt: Buffer) {
  return scryptSync(passphrase, salt, 32)
}

// Fails fast on boot instead of on the first secret write.
export function assertMasterKey() {
  masterKey()
}
