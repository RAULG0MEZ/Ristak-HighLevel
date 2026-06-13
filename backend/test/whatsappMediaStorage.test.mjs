import test from 'node:test'
import assert from 'node:assert/strict'

const ONE_PIXEL_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

const ENV_KEYS = [
  'DATABASE_URL',
  'MEDIA_STORAGE_PROVIDER',
  'MEDIA_STORAGE_REQUIRE_BUNNY',
  'BUNNY_STORAGE_ZONE',
  'BUNNY_STORAGE_REGION',
  'BUNNY_STORAGE_ENDPOINT',
  'BUNNY_STORAGE_API_KEY',
  'BUNNY_CDN_BASE_URL',
  'BUNNY_STREAM_LIBRARY_ID',
  'BUNNY_STREAM_API_KEY',
  'WHATSAPP_LOCAL_MEDIA_FALLBACK',
  'RENDER_EXTERNAL_URL',
  'PUBLIC_URL'
]

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
}

function restoreEnv(snapshot) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = snapshot[key]
    }
  }
}

test('requirePublicMediaUrl conserva URLs CDN absolutas y exige base HTTPS para paths locales', async () => {
  const previousEnv = snapshotEnv()
  try {
    delete process.env.DATABASE_URL
    process.env.RENDER_EXTERNAL_URL = 'https://app-demo.onrender.com'

    const { requirePublicMediaUrl } = await import('../src/services/whatsappApiService.js')

    assert.equal(
      requirePublicMediaUrl({ publicPath: 'https://cdn.ristak.com/businesses/default/chat/foto.webp' }, 'https://app-demo.onrender.com', 'fotos'),
      'https://cdn.ristak.com/businesses/default/chat/foto.webp'
    )
    assert.equal(
      requirePublicMediaUrl({ publicPath: '/media/assets/media_123/file' }, 'https://app-demo.onrender.com', 'fotos'),
      'https://app-demo.onrender.com/media/assets/media_123/file'
    )
    assert.throws(
      () => requirePublicMediaUrl({ publicPath: '/uploads/whatsapp-images/foto.png' }, 'http://localhost:3001', 'fotos'),
      /URL HTTPS/
    )
  } finally {
    restoreEnv(previousEnv)
  }
})

test('saveWhatsAppImageDataUrl falla claro cuando Bunny es obligatorio y no está configurado', async () => {
  const previousEnv = snapshotEnv()
  let db = null
  let previousSettings = null

  try {
    delete process.env.DATABASE_URL
    delete process.env.BUNNY_STORAGE_ZONE
    delete process.env.BUNNY_STORAGE_REGION
    delete process.env.BUNNY_STORAGE_ENDPOINT
    delete process.env.BUNNY_STORAGE_API_KEY
    delete process.env.BUNNY_CDN_BASE_URL
    delete process.env.BUNNY_STREAM_LIBRARY_ID
    delete process.env.BUNNY_STREAM_API_KEY
    delete process.env.WHATSAPP_LOCAL_MEDIA_FALLBACK
    process.env.MEDIA_STORAGE_PROVIDER = 'bunny'
    process.env.MEDIA_STORAGE_REQUIRE_BUNNY = 'true'

    const whatsappApiService = await import('../src/services/whatsappApiService.js')
    const database = await import('../src/config/database.js')
    db = database.db
    previousSettings = await db.get(`
      SELECT bunny_storage_zone, bunny_storage_region, bunny_cdn_base_url, bunny_stream_library_id
      FROM storage_settings
      WHERE id = 1
    `)
    await db.run(`
      UPDATE storage_settings SET
        bunny_storage_zone = NULL,
        bunny_storage_region = NULL,
        bunny_cdn_base_url = NULL,
        bunny_stream_library_id = NULL
      WHERE id = 1
    `)

    await assert.rejects(
      () => whatsappApiService.saveWhatsAppImageDataUrl(ONE_PIXEL_PNG_DATA_URL),
      (error) => {
        assert.equal(error.code, 'bunny_not_configured')
        assert.match(error.message, /Bunny\.net está activo/)
        return true
      }
    )
  } finally {
    if (db && previousSettings) {
      await db.run(`
        UPDATE storage_settings SET
          bunny_storage_zone = ?,
          bunny_storage_region = ?,
          bunny_cdn_base_url = ?,
          bunny_stream_library_id = ?
        WHERE id = 1
      `, [
        previousSettings.bunny_storage_zone,
        previousSettings.bunny_storage_region,
        previousSettings.bunny_cdn_base_url,
        previousSettings.bunny_stream_library_id
      ]).catch(() => undefined)
    }
    restoreEnv(previousEnv)
  }
})
