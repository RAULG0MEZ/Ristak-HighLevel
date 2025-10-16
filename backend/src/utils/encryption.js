import crypto from 'crypto'
import { logger } from './logger.js'

// Algoritmo de encriptación (AES-256-GCM es el más seguro)
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16  // 128 bits
const SALT_LENGTH = 64
const TAG_LENGTH = 16

/**
 * Obtiene la clave maestra de encriptación desde variables de entorno
 * Si no existe, genera una temporal (solo para desarrollo)
 */
function getMasterKey() {
  const envKey = process.env.ENCRYPTION_MASTER_KEY

  if (envKey) {
    return Buffer.from(envKey, 'hex')
  }

  // En desarrollo, generar una clave temporal
  logger.warn('⚠️  ENCRYPTION_MASTER_KEY no encontrada. Generando clave temporal (solo desarrollo)')
  logger.warn('   Para producción, agrega ENCRYPTION_MASTER_KEY en tu .env')

  const tempKey = crypto.randomBytes(KEY_LENGTH)
  logger.info('   Clave temporal generada:', tempKey.toString('hex'))

  return tempKey
}

/**
 * Deriva una clave de encriptación desde la clave maestra usando PBKDF2
 */
function deriveKey(masterKey, salt) {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha512')
}

/**
 * Encripta un texto usando AES-256-GCM
 * @param {string} text - Texto a encriptar
 * @returns {string} - Texto encriptado en formato "salt:iv:tag:encrypted"
 */
export function encrypt(text) {
  if (!text) {
    throw new Error('No se puede encriptar un texto vacío')
  }

  try {
    const masterKey = getMasterKey()

    // Generar salt, IV y derivar clave
    const salt = crypto.randomBytes(SALT_LENGTH)
    const iv = crypto.randomBytes(IV_LENGTH)
    const key = deriveKey(masterKey, salt)

    // Crear cipher y encriptar
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // Obtener tag de autenticación (importante para GCM)
    const tag = cipher.getAuthTag()

    // Retornar todo concatenado en formato: salt:iv:tag:encrypted
    return [
      salt.toString('hex'),
      iv.toString('hex'),
      tag.toString('hex'),
      encrypted
    ].join(':')
  } catch (error) {
    logger.error('Error encriptando:', error)
    throw new Error('Error al encriptar datos sensibles')
  }
}

/**
 * Desencripta un texto usando AES-256-GCM
 * @param {string} encryptedData - Texto encriptado en formato "salt:iv:tag:encrypted"
 * @returns {string} - Texto desencriptado
 */
export function decrypt(encryptedData) {
  if (!encryptedData) {
    throw new Error('No hay datos para desencriptar')
  }

  try {
    const masterKey = getMasterKey()

    // Separar componentes del texto encriptado
    const parts = encryptedData.split(':')
    if (parts.length !== 4) {
      throw new Error('Formato de datos encriptados inválido')
    }

    const [saltHex, ivHex, tagHex, encrypted] = parts

    // Convertir de hex a Buffer
    const salt = Buffer.from(saltHex, 'hex')
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')

    // Derivar la misma clave
    const key = deriveKey(masterKey, salt)

    // Crear decipher y desencriptar
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    logger.error('Error desencriptando:', error)
    throw new Error('Error al desencriptar datos. Verifica tu ENCRYPTION_MASTER_KEY')
  }
}

/**
 * Genera una nueva clave maestra para usar como ENCRYPTION_MASTER_KEY
 * Solo para setup inicial
 */
export function generateMasterKey() {
  const key = crypto.randomBytes(KEY_LENGTH)
  return key.toString('hex')
}

/**
 * Verifica si un texto está encriptado (tiene el formato correcto)
 */
export function isEncrypted(text) {
  if (!text || typeof text !== 'string') return false
  const parts = text.split(':')
  return parts.length === 4
}
