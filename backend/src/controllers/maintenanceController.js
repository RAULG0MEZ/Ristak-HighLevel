import { db } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Endpoint para actualizar visitor_ids faltantes en contactos
 */
export const fixVisitorIds = async (req, res) => {
  try {
    logger.info('🔧 Iniciando actualización de visitor_ids...');

    // Obtener todos los contactos sin visitor_id que tienen email o teléfono
    const contacts = await db.all(`
      SELECT id, email, phone
      FROM contacts
      WHERE visitor_id IS NULL
        AND (email IS NOT NULL OR phone IS NOT NULL)
    `);

    logger.info(`📊 Encontrados ${contacts.length} contactos sin visitor_id`);

    let updated = 0;
    let notFound = 0;
    const results = [];

    for (const contact of contacts) {
      try {
        let sessionQuery = '';
        let sessionParams = [];

        // Buscar por email y teléfono
        if (contact.email && contact.phone) {
          sessionQuery = `
            SELECT visitor_id
            FROM sessions
            WHERE email = ?
              OR LOWER(REPLACE(REPLACE(REPLACE(phone, '+', ''), '-', ''), ' ', '')) = LOWER(REPLACE(REPLACE(REPLACE(?, '+', ''), '-', ''), ' ', ''))
            ORDER BY started_at ASC
            LIMIT 1
          `;
          sessionParams = [contact.email, contact.phone];
        } else if (contact.email) {
          sessionQuery = `
            SELECT visitor_id
            FROM sessions
            WHERE email = ?
            ORDER BY started_at ASC
            LIMIT 1
          `;
          sessionParams = [contact.email];
        } else if (contact.phone) {
          sessionQuery = `
            SELECT visitor_id
            FROM sessions
            WHERE LOWER(REPLACE(REPLACE(REPLACE(phone, '+', ''), '-', ''), ' ', '')) = LOWER(REPLACE(REPLACE(REPLACE(?, '+', ''), '-', ''), ' ', ''))
            ORDER BY started_at ASC
            LIMIT 1
          `;
          sessionParams = [contact.phone];
        }

        if (sessionQuery) {
          const session = await db.get(sessionQuery, sessionParams);

          if (session?.visitor_id) {
            // Actualizar el contacto con el visitor_id encontrado
            await db.run(`
              UPDATE contacts
              SET visitor_id = ?
              WHERE id = ?
            `, [session.visitor_id, contact.id]);

            // Actualizar también las sessions para vincularlas al contact_id
            await db.run(`
              UPDATE sessions
              SET contact_id = ?
              WHERE visitor_id = ? AND contact_id IS NULL
            `, [contact.id, session.visitor_id]);

            updated++;
            results.push({
              contact_id: contact.id,
              visitor_id: session.visitor_id,
              status: 'updated'
            });
            logger.info(`✅ Actualizado contacto ${contact.id} con visitor_id ${session.visitor_id}`);
          } else {
            notFound++;
            results.push({
              contact_id: contact.id,
              status: 'no_sessions'
            });
          }
        }
      } catch (err) {
        logger.error(`Error procesando contacto ${contact.id}: ${err.message}`);
        results.push({
          contact_id: contact.id,
          status: 'error',
          error: err.message
        });
      }
    }

    const summary = {
      total_processed: contacts.length,
      updated,
      no_sessions: notFound,
      errors: results.filter(r => r.status === 'error').length
    };

    logger.info(`🎉 Actualización completada:`);
    logger.info(`   - Actualizados: ${updated}`);
    logger.info(`   - Sin sessions: ${notFound}`);
    logger.info(`   - Total procesados: ${contacts.length}`);

    res.json({
      success: true,
      summary,
      results
    });

  } catch (error) {
    logger.error(`Error en fixVisitorIds: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
