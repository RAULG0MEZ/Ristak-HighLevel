import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: 'postgresql://ristak_production_lrx7_user:2u01O2msGhIld5hiUOwMxrFg3tRSnVMG@dpg-d3orenemcj7s739hdg90-a.oregon-postgres.render.com/ristak_production_lrx7',
  ssl: { rejectUnauthorized: false }
})

const ACCESS_TOKEN = 'EAAHdL10CRwsBP7e8fizMEXs0ZCZCTMUKnr07fvXLeqqsKuXvRby6ckzRp8mkj16NV0bembYsUYstH8JNXf1fTRngDUBPutZCkQztwEZAfIqZBHcQ8aMOeByExTCHu0H9LnKeVOf9iG8VQgRWeCYbt4VV2jOk2MLnMoSJTj8mZCdPg6jEt4RQKerOWCxu6zf2q5igZDZD'

;(async () => {
  try {
    // Obtener pixel_id de la base de datos
    const result = await pool.query('SELECT pixel_id FROM meta_config LIMIT 1')

    if (!result.rows || result.rows.length === 0 || !result.rows[0].pixel_id) {
      console.log('❌ No hay Pixel ID configurado en la base de datos')
      await pool.end()
      process.exit(1)
    }

    const pixelId = result.rows[0].pixel_id
    console.log('✅ Pixel ID:', pixelId)
    console.log('✅ Access Token:', ACCESS_TOKEN.substring(0, 30) + '...\n')

    const url = `https://graph.facebook.com/v22.0/${pixelId}/access_tokens?access_token=${ACCESS_TOKEN}`

    // Primera llamada
    console.log('🔵 Llamada 1 a Meta API...')
    const response1 = await fetch(url, { method: 'POST' })
    const data1 = await response1.json()

    if (data1.error) {
      console.error('❌ Error en llamada 1:', JSON.stringify(data1.error, null, 2))
      await pool.end()
      process.exit(1)
    }

    console.log('✅ Token 1 generado!')
    console.log('   Primeros 30 chars:', data1.access_token.substring(0, 30) + '...')
    console.log('   Longitud:', data1.access_token.length, 'caracteres')

    // Esperar 2 segundos
    console.log('\n⏳ Esperando 2 segundos...\n')
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Segunda llamada
    console.log('🔵 Llamada 2 a Meta API...')
    const response2 = await fetch(url, { method: 'POST' })
    const data2 = await response2.json()

    if (data2.error) {
      console.error('❌ Error en llamada 2:', JSON.stringify(data2.error, null, 2))
      await pool.end()
      process.exit(1)
    }

    console.log('✅ Token 2 generado!')
    console.log('   Primeros 30 chars:', data2.access_token.substring(0, 30) + '...')
    console.log('   Longitud:', data2.access_token.length, 'caracteres')

    // Comparar
    console.log('\n' + '='.repeat(60))
    console.log('📊 RESULTADO DE LA PRUEBA')
    console.log('='.repeat(60))

    if (data1.access_token === data2.access_token) {
      console.log('\n✅ Los tokens SON IDÉNTICOS')
      console.log('\n📝 Conclusión:')
      console.log('   Meta devuelve SIEMPRE el mismo Pixel API Token para el')
      console.log('   mismo pixel. No importa cuántas veces lo llames, siempre')
      console.log('   obtendrás el mismo token.')
      console.log('\n💡 Esto significa:')
      console.log('   - NO necesitas regenerarlo cada vez')
      console.log('   - Puedes guardarlo una vez y reutilizarlo')
      console.log('   - Si ya lo tienes guardado, es el correcto')
    } else {
      console.log('\n❌ Los tokens SON DIFERENTES')
      console.log('\n📝 Conclusión:')
      console.log('   Meta genera un token NUEVO cada vez que lo solicitas.')
      console.log('\n💡 Esto significa:')
      console.log('   - Debes tener cuidado de no regenerarlo innecesariamente')
      console.log('   - Guarda el token generado la primera vez')
      console.log('   - Solo regenera si es necesario')
    }

    console.log('\n' + '='.repeat(60))
    console.log('Token completo 1:', data1.access_token)
    console.log('Token completo 2:', data2.access_token)
    console.log('='.repeat(60) + '\n')

    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('💥 Error:', error.message)
    await pool.end()
    process.exit(1)
  }
})()
