import { db } from './src/config/database.js';
import fetch from 'node-fetch';

async function testCustomFields() {
  console.log('\n🔍 INVESTIGANDO CUSTOM FIELDS Y ATTRIBUTION\n');
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

  // Obtener varios contactos con diferentes attribution_ad_id
  const contacts = await db.all(`
    SELECT id, full_name, attribution_ad_id
    FROM contacts
    WHERE attribution_ad_id IS NOT NULL
    AND attribution_ad_id IN ('eLEfv3OpL2edQjDmLLot', '120224344883760604', '120218761619020604')
    LIMIT 6
  `);

  console.log(`📋 Analizando ${contacts.length} contactos...\n`);

  for (const contact of contacts) {
    console.log('=' . repeat(80));
    console.log(`\n👤 ${contact.full_name}`);
    console.log(`   ID: ${contact.id}`);
    console.log(`   attribution_ad_id en DB: ${contact.attribution_ad_id}`);

    // Obtener el contacto completo de HighLevel
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contact.id}`,
      {
        headers: {
          'Authorization': `Bearer ${config.api_token}`,
          'Version': '2021-07-28'
        }
      }
    );

    if (!response.ok) {
      console.log(`   ❌ Error obteniendo contacto: ${response.status}`);
      continue;
    }

    const data = await response.json();
    const ghlContact = data.contact || data;

    // 1. Revisar attributions
    console.log('\n   📦 ATTRIBUTIONS:');
    if (ghlContact.attributions && ghlContact.attributions.length > 0) {
      ghlContact.attributions.forEach((attr, i) => {
        console.log(`      Attribution ${i + 1}:`);
        console.log(`         isFirst: ${attr.isFirst}`);
        console.log(`         utmAdId: ${attr.utmAdId}`);
        console.log(`         mediumId: ${attr.mediumId}`);
        console.log(`         url: ${attr.url || attr.pageUrl}`);
      });
    } else {
      console.log('      ❌ No tiene attributions');
    }

    // 2. Revisar custom fields
    console.log('\n   🏷️ CUSTOM FIELDS:');
    if (ghlContact.customFields && ghlContact.customFields.length > 0) {
      ghlContact.customFields.forEach(field => {
        // Buscar campos que puedan contener el ad_id
        if (field && field.value && field.key && (
          field.value.includes('120') ||
          field.value === contact.attribution_ad_id ||
          field.key.toLowerCase().includes('ad') ||
          field.key.toLowerCase().includes('utm') ||
          field.key.toLowerCase().includes('facebook') ||
          field.key.toLowerCase().includes('medium')
        )) {
          console.log(`      ${field.key}: ${field.value}`);
        }
      });
    } else {
      console.log('      No tiene custom fields relevantes');
    }

    // 3. Revisar tags
    console.log('\n   🏷️ TAGS:');
    if (ghlContact.tags && ghlContact.tags.length > 0) {
      console.log(`      ${ghlContact.tags.join(', ')}`);
    } else {
      console.log('      No tiene tags');
    }

    // 4. Revisar source
    console.log('\n   🔗 SOURCE:');
    console.log(`      ${ghlContact.source || 'Sin source'}`);

    // 5. Revisar todos los campos del contacto que contengan IDs sospechosos
    console.log('\n   🔍 BÚSQUEDA DE IDs EN TODOS LOS CAMPOS:');
    const searchId = contact.attribution_ad_id;
    const contactStr = JSON.stringify(ghlContact);

    if (contactStr.includes(searchId)) {
      console.log(`      ✅ Encontrado "${searchId}" en el contacto`);

      // Buscar en qué campo específico está
      Object.entries(ghlContact).forEach(([key, value]) => {
        const valueStr = JSON.stringify(value);
        if (valueStr.includes(searchId)) {
          console.log(`         → En campo "${key}"`);
          if (typeof value === 'object') {
            // Si es un objeto, buscar más profundo
            if (Array.isArray(value)) {
              value.forEach((item, i) => {
                if (JSON.stringify(item).includes(searchId)) {
                  console.log(`            → En ${key}[${i}]: ${JSON.stringify(item).substring(0, 200)}`);
                }
              });
            } else {
              Object.entries(value).forEach(([subKey, subValue]) => {
                if (JSON.stringify(subValue).includes(searchId)) {
                  console.log(`            → En ${key}.${subKey}: ${subValue}`);
                }
              });
            }
          }
        }
      });
    } else {
      console.log(`      ❌ No se encontró "${searchId}" en ningún campo del contacto`);
    }
  }

  console.log('\n\n✅ Análisis completado');
  process.exit(0);
}

testCustomFields().catch(console.error);