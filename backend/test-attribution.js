import { db } from './src/config/database.js';
import fetch from 'node-fetch';

async function testAttribution() {
  console.log('\n🔍 INVESTIGANDO ATTRIBUTION_AD_ID\n');
  console.log('=' . repeat(80));

  // 1. Ver ejemplos de la DB
  console.log('\n📊 DATOS EN LA BASE DE DATOS:');
  const examples = await db.all(`
    SELECT
      id,
      full_name,
      attribution_ad_id,
      attribution_url,
      created_at
    FROM contacts
    WHERE attribution_ad_id IS NOT NULL
    LIMIT 5
  `);

  for (const contact of examples) {
    console.log(`\n👤 ${contact.full_name}`);
    console.log(`   ID del contacto: ${contact.id}`);
    console.log(`   Attribution AD ID: ${contact.attribution_ad_id}`);

    // Parsear la URL para ver los parámetros
    if (contact.attribution_url) {
      try {
        const url = new URL(contact.attribution_url);
        const adIdFromUrl = url.searchParams.get('ad_id') || url.searchParams.get('utm_content');
        const utmAdId = url.searchParams.get('utm_ad_id');
        const cmcAdId = url.searchParams.get('cmc_adid');

        console.log(`   Parámetros en URL:`);
        console.log(`     - ad_id: ${adIdFromUrl}`);
        console.log(`     - utm_ad_id: ${utmAdId}`);
        console.log(`     - utm_content: ${url.searchParams.get('utm_content')}`);
        console.log(`     - cmc_adid: ${cmcAdId}`);

        // Comparar
        if (contact.attribution_ad_id !== adIdFromUrl && adIdFromUrl) {
          console.log(`   ⚠️ DISCREPANCIA: attribution_ad_id (${contact.attribution_ad_id}) != ad_id en URL (${adIdFromUrl})`);
        }
      } catch (e) {
        console.log(`   ❌ No se pudo parsear URL: ${e.message}`);
      }
    }
  }

  // 2. Obtener un contacto directo de HighLevel API
  console.log('\n\n📡 LLAMANDO A HIGHLEVEL API DIRECTAMENTE:');
  console.log('=' . repeat(80));

  // Obtener config de HighLevel
  const config = await db.get(`
    SELECT location_id, api_token
    FROM highlevel_config
    LIMIT 1
  `);

  if (!config) {
    console.log('❌ No hay configuración de HighLevel');
    return;
  }

  // Tomar un contacto de ejemplo que tenga attribution_ad_id
  const testContact = await db.get(`
    SELECT id
    FROM contacts
    WHERE attribution_ad_id IS NOT NULL
    LIMIT 1
  `);

  if (!testContact) {
    console.log('❌ No hay contactos con attribution_ad_id');
    return;
  }

  // Llamar a la API de HighLevel
  console.log(`\n🔍 Obteniendo contacto ${testContact.id} de HighLevel...`);

  const response = await fetch(
    `https://services.leadconnectorhq.com/contacts/${testContact.id}`,
    {
      headers: {
        'Authorization': `Bearer ${config.api_token}`,
        'Version': '2021-07-28'
      }
    }
  );

  if (!response.ok) {
    console.log(`❌ Error de API: ${response.status}`);
    return;
  }

  const data = await response.json();
  const contact = data.contact || data;

  console.log('\n📦 ESTRUCTURA DE ATTRIBUTION DE HIGHLEVEL:');
  console.log(JSON.stringify(contact.attributions, null, 2));

  // Buscar el primer attribution
  const firstAttribution = contact.attributions?.find(a => a.isFirst);

  if (firstAttribution) {
    console.log('\n🎯 FIRST ATTRIBUTION:');
    console.log(`   utmAdId: ${firstAttribution.utmAdId}`);
    console.log(`   mediumId: ${firstAttribution.mediumId}`);
    console.log(`   adName: ${firstAttribution.adName}`);
    console.log(`   url: ${firstAttribution.url || firstAttribution.pageUrl}`);
    console.log(`   utmSessionSource: ${firstAttribution.utmSessionSource}`);
    console.log(`   medium: ${firstAttribution.medium}`);

    console.log('\n🔑 TODOS LOS CAMPOS DE FIRST ATTRIBUTION:');
    Object.keys(firstAttribution).forEach(key => {
      console.log(`   ${key}: ${firstAttribution[key]}`);
    });
  } else {
    console.log('❌ No hay firstAttribution');
  }

  // 3. Análisis de discrepancias
  console.log('\n\n📈 ANÁLISIS DE DISCREPANCIAS:');
  console.log('=' . repeat(80));

  const analysis = await db.all(`
    SELECT
      attribution_ad_id,
      COUNT(*) as count,
      MIN(created_at) as first_seen,
      MAX(created_at) as last_seen
    FROM contacts
    WHERE attribution_ad_id IS NOT NULL
    GROUP BY attribution_ad_id
    ORDER BY count DESC
    LIMIT 10
  `);

  console.log('\nTop 10 attribution_ad_ids más comunes:');
  for (const row of analysis) {
    const isNumeric = /^\d+$/.test(row.attribution_ad_id);
    console.log(`   ${row.attribution_ad_id} (${isNumeric ? 'numérico' : 'texto'}) - ${row.count} contactos`);
  }

  // 4. Verificar si hay un patrón en los IDs
  const numericIds = await db.all(`
    SELECT DISTINCT attribution_ad_id
    FROM contacts
    WHERE attribution_ad_id ~ '^[0-9]+$'
    LIMIT 20
  `).catch(() =>
    // Fallback para SQLite
    db.all(`
      SELECT DISTINCT attribution_ad_id
      FROM contacts
      WHERE attribution_ad_id GLOB '[0-9]*'
      LIMIT 20
    `)
  );

  console.log('\n🔢 Análisis de IDs numéricos:');
  const suffixes = {};
  for (const row of numericIds) {
    const id = row.attribution_ad_id;
    const last4 = id.slice(-4);
    suffixes[last4] = (suffixes[last4] || 0) + 1;
  }

  console.log('Sufijos más comunes (últimos 4 dígitos):');
  Object.entries(suffixes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([suffix, count]) => {
      console.log(`   ...${suffix}: ${count} veces`);
    });

  console.log('\n✅ Análisis completado');
  process.exit(0);
}

testAttribution().catch(console.error);