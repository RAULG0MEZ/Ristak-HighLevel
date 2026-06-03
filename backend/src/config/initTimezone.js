// Fija la zona horaria del proceso Node en UTC.
//
// Por qué: node-postgres interpreta las columnas `timestamp` (sin zona) usando la
// zona del proceso. Si el contenedor no estuviera en UTC, los timestamps leídos se
// desplazarían. Forzando UTC aquí la lectura es determinista y coincide con la
// sesión de Postgres (que también se fija en UTC en database.js).
//
// Debe importarse ANTES que cualquier otro módulo que use fechas o abra la conexión.
process.env.TZ = 'UTC'
