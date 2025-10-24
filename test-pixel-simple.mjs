import pg from 'pg'
import crypto from 'crypto'

const { Pool } = pg

const pool = new Pool({
  connectionString: 'postgresql://ristak_production_lrx7_user:2u01O2msGhIld5hiUOwMxrFg3tRSnVMG@dpg-d3orenemcj7s739hdg90-a.oregon-postgres.render.com/ristak_production_lrx7',
  ssl: { rejectUnauthorized: false }
})

// Función decrypt copiada
const ENCRYPTION_MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || 'clave-maestra-super-secreta-2024-ristak'
const ALGORITHM = 'aes-256-gcm'

function decrypt(encryptedText) {
  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const key = crypto.scryptSync(ENCRYPTION_MASTER_KEY, 'salt', 32)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    throw new Error(`Error desencriptando: ${error.message}`)
  }
}

function isEncrypted(text) {
  if (!text || typeof text !== 'string') return false
  const parts = text.split(':')
  return parts.length === 3 && /^[0-9a-f]+$/.test(parts[0]) && /^[0-9a-f]+$/.test(parts[1])
}

(async () => {
  try {
    const result = await pool.query('SELECT access_token, pixel_id FROM meta_config LIMIT 1')

    if (!result.rows || result.rows.length === 0) {
      console.log('❌ No hay configuración de Meta')
      await pool.end()
      process.exit(1)
    }

    const config = result.rows[0]

    if (!config.pixel_id) {
      console.log('❌ No hay Pixel ID configurado')
      await pool.end()
      process.exit(1)
    }

    const token = isEncrypted(config.access_token)
      ? decrypt(config.access_token)
      : config.access_token

    console.log('✅ Access Token:', token.substring(0, 20) + '...')
    console.log('✅ Pixel ID:', config.pixel_id)

    const pixelId = config.pixel_id
    const url = `https://graph.facebook.com/v22.0/${pixelId}/access_tokens?access_token=${token}`

    console.log('\n🔵 Llamada 1 a Meta API...')
    const response1 = await fetch(url, { method: 'POST' })
    const data1 = await response1.json()

    if (data1.error) {
      console.error('❌ Error:', JSON.stringify(data1.error, null, 2))
      await pool.end()
      process.exit(1)
    }

    console.log('✅ Token 1:', data1.access_token.substring(0, 30) + '...')

    console.log('\n⏳ Esperando 2 segundos...\n')
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log('🔵 Llamada 2 a Meta API...')
    const response2 = await fetch(url, { method: 'POST' })
    const data2 = await response2.json()

    if (data2.error) {
      console.error('❌ Error:', JSON.stringify(data2.error, null, 2))
      await pool.end()
      process.exit(1)
    }

    console.log('✅ Token 2:', data2.access_token.substring(0, 30) + '...')

    console.log('\n📊 RESULTADO:')
    if (data1.access_token === data2.access_token) {
      console.log('✅ Los tokens SON IGUALES')
      console.log('📝 Conclusión: Meta devuelve el mismo token cada vez para el mismo pixel')
    } else {
      console.log('❌ Los tokens SON DIFERENTES')
      console.log('📝 Conclusión: Meta genera un token nuevo cada vez')
    }

    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('💥 Error:', error.message)
    await pool.end()
    process.exit(1)
  }
})()
