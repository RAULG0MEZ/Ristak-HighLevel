import { logger } from '../utils/logger.js';
import { db } from '../config/database.js';
import {
  getAccountTimezone,
  isValidTimezone,
  invalidateTimezoneCache,
  ACCOUNT_TIMEZONE_CONFIG_KEY
} from '../utils/dateUtils.js';

/**
 * Obtiene la zona horaria efectiva de la cuenta.
 * Prioridad: override de Ristak > HighLevel > default.
 */
export const getTimezone = async (req, res) => {
  try {
    const timezone = await getAccountTimezone();

    // Indicar si la zona viene de un override explícito de Ristak (para la UI)
    const override = await db.get(
      'SELECT config_value FROM app_config WHERE config_key = ?',
      [ACCOUNT_TIMEZONE_CONFIG_KEY]
    ).catch(() => null);

    res.json({
      success: true,
      timezone,
      source: override?.config_value ? 'ristak' : 'highlevel'
    });

  } catch (error) {
    logger.error(`Error en getTimezone: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Error al obtener la zona horaria'
    });
  }
};

/**
 * Guarda la zona horaria elegida por el usuario en Ristak.
 * Se persiste en app_config y pasa a ser la fuente de verdad (sobre HighLevel).
 * Enviar timezone vacío/null limpia el override y vuelve a usar HighLevel/default.
 */
export const setTimezone = async (req, res) => {
  try {
    const { timezone } = req.body || {};

    // Permitir limpiar el override (volver a HighLevel/default)
    if (timezone === null || timezone === '' || timezone === undefined) {
      await db.run('DELETE FROM app_config WHERE config_key = ?', [ACCOUNT_TIMEZONE_CONFIG_KEY]);
      invalidateTimezoneCache();
      const resolved = await getAccountTimezone();
      return res.json({ success: true, timezone: resolved, source: 'highlevel' });
    }

    if (!isValidTimezone(timezone)) {
      return res.status(400).json({
        success: false,
        error: `Zona horaria inválida: ${timezone}`
      });
    }

    await db.run(`
      INSERT INTO app_config (config_key, config_value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(config_key) DO UPDATE SET
        config_value = excluded.config_value,
        updated_at = CURRENT_TIMESTAMP
    `, [ACCOUNT_TIMEZONE_CONFIG_KEY, timezone]);

    invalidateTimezoneCache();

    logger.info(`Zona horaria de la cuenta actualizada a: ${timezone}`);

    res.json({
      success: true,
      timezone,
      source: 'ristak'
    });

  } catch (error) {
    logger.error(`Error en setTimezone: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Error al guardar la zona horaria'
    });
  }
};
