import { decrypt, isEncrypted } from './backend/src/utils/encryption.js'
import pg from 'pg'

const { Pool } = pg

// Usar PostgreSQL de producción
const pool = new Pool({
  connectionString: 'postgresql://ristak_production_lrx7_user:2u01O2msGhIld5hiUOwMxrFg3tRSnVMG@dpg-d3orenemcj7s739hdg90-a.oregon-postgres.render.com/ristak_production_lrx7',
  ssl: { rejectUnauthorized: false }
})

(async () => {
  try {
    const result = await pool.query('SELECT access_token, pixel_id FROM meta_config LIMIT 1')

    if (!result.rows || result.rows.length === 0) {
      console.log('No hay configuración de Meta')
      process.exit(1)
    }

    const config = result.rows[0]

    const token = isEncrypted(config.access_token)
      ? decrypt(config.access_token)
      : config.access_token

    console.log('Access Token:', token.substring(0, 20) + '...')
    console.log('Pixel ID:', config.pixel_id)

    // Ahora hacer llamada a Meta API para generar token
    const pixelId = config.pixel_id
    const url = `https://graph.facebook.com/v22.0/${pixelId}/access_tokens?access_token=${token}`

    console.log('\n🔵 Haciendo llamada 1 a Meta API...')
    const response1 = await fetch(url, { method: 'POST' })
    const data1 = await response1.json()

    if (data1.error) {
      console.error('❌ Error:', data1.error)
      process.exit(1)
    }

    console.log('✅ Token 1:', data1.access_token)

    // Esperar 2 segundos y generar otro
    console.log('\n⏳ Esperando 2 segundos...\n')
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log('🔵 Haciendo llamada 2 a Meta API...')
    const response2 = await fetch(url, { method: 'POST' })
    const data2 = await response2.json()

    if (data2.error) {
      console.error('❌ Error:', data2.error)
      process.exit(1)
    }

    console.log('✅ Token 2:', data2.access_token)

    console.log('\n📊 Comparación:')
    console.log('Son iguales?', data1.access_token === data2.access_token)

    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error.message)
    await pool.end()
    process.exit(1)
  }
})()
