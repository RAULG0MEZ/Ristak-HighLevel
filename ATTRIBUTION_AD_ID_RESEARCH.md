# INVESTIGACIÓN COMPLETA: ASIGNACIÓN DE attribution_ad_id

## 1. ESQUEMA DE LA TABLA contacts

**Archivo**: `/backend/src/config/database.js` (línea 184-205)

```sql
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  source TEXT,
  visitor_id TEXT,                           -- Vinculación con sesiones de tracking
  attribution_url TEXT,                      -- URL de la landing page
  attribution_session_source TEXT,           -- Source de la sesión
  attribution_medium TEXT,                   -- Medium UTM
  attribution_ctwa_clid TEXT,               -- Click ID de WhatsApp
  attribution_ad_name TEXT,                 -- Nombre del anuncio
  attribution_ad_id TEXT,                   -- <-- CAMPO CLAVE (puede ser NULL)
  total_paid REAL DEFAULT 0,
  purchases_count INTEGER DEFAULT 0,
  last_purchase_date DATETIME,
  appointment_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- Índice para consultas rápidas
CREATE INDEX idx_contacts_ad_id ON contacts(attribution_ad_id)
```

**Observación**: `attribution_ad_id` es TEXT (no INTEGER), puede ser NULL o vacío string.

---

## 2. FLUJO COMPLETO DE ASIGNACIÓN DE attribution_ad_id

### FUENTE 1: WEBHOOK DE CONTACTO DESDE HIGHLEVEL

**Archivo**: `/backend/src/controllers/webhooksController.js` (línea 9-127)

**Función**: `handleContactWebhook(req, res)`

**Cómo funciona**:
1. HighLevel envía un webhook cuando un contacto es creado o actualizado
2. El webhook contiene estructura de atribución de HighLevel
3. Se extrae el "first attribution" del contacto

**Líneas clave**:
```javascript
// Línea 32-36: Extrae atribución en este orden de prioridad
const attribution = data.attributions?.find(a => a.isFirst)
  || data.contact?.attributionSource
  || data.contact?.lastAttributionSource
  || data.attributionSource
  || {};

// Línea 85: ASIGNA attribution_ad_id EN LA BD
attribution.utmAdId || attribution.mediumId

// Línea 73-88: INSERT query que guarda el contacto
await db.run(query, [
  contactId,
  phone,
  email,
  full_name,
  first_name,
  last_name,
  source,
  attribution.pageUrl || attribution.url,          // attribution_url
  attribution.utmSessionSource,                    // attribution_session_source
  attribution.medium,                              // attribution_medium
  attribution.utmAdId || attribution.mediumId,     // attribution_ad_id << AQUÍ
  attribution.adName,                              // attribution_ad_name
  visitorId
])
```

**Campos de HighLevel que se mapean**:
- `attribution.utmAdId` → `attribution_ad_id` (PRIORIDAD 1)
- `attribution.mediumId` → `attribution_ad_id` (PRIORIDAD 2)
- `attribution.adName` → `attribution_ad_name`
- `attribution.pageUrl` o `attribution.url` → `attribution_url`

---

### FUENTE 2: SINCRONIZACIÓN MANUAL DE HIGHLEVEL

**Archivo**: `/backend/src/services/highlevelSyncService.js` (línea 464-577)

**Función**: `syncHighLevelContacts(locationId, apiToken)`

**Cómo funciona**:
1. Obtiene TODOS los contactos de HighLevel via API paginada
2. Itera sobre cada contacto
3. Extrae el "first attribution"
4. Guarda en la BD con INSERT OR REPLACE

**Líneas clave**:
```javascript
// Línea 510: Obtiene el primer attribution del contacto de GHL
const attribution = contact.attributions?.find(a => a.isFirst) || {}

// Línea 545-561: INSERT/REPLACE en BD
await db.run(query, [
  contact.id,
  contact.phone,
  contact.email,
  full_name,
  firstName,
  lastName,
  source,
  attribution.pageUrl || attribution.url,          // attribution_url
  attribution.utmSessionSource,                    // attribution_session_source
  attribution.medium,                              // attribution_medium
  attribution.utmAdId,                             // attribution_ad_id << AQUÍ
  attribution.adName,                              // attribution_ad_name
  visitorId,
  created_at,
  updated_at
])
```

**Mismo mapeo que webhook pero sin `mediumId` alternativo**.

---

### FUENTE 3: CREACIÓN DE CONTACTO DURANTE SINCRONIZACIÓN DE CITAS

**Archivo**: `/backend/src/services/highlevelSyncService.js` (línea 378-459)

**Función**: `ensureContactExists(contactId, apiToken, usePostgres)`

**Cuándo se ejecuta**: Si un contacto no existe cuando se sincroniza una cita.

**Líneas clave**:
```javascript
// Línea 406: Obtiene atribución del contacto de GHL
const attribution = contact.attributions?.find(a => a.isFirst) || {}

// Línea 425-452: INSERT con atribución
await db.run(query, [
  contact.id,
  phone,
  email,
  contactName,
  firstName,
  lastName,
  source,
  attribution.pageUrl || attribution.url,          // attribution_url
  attribution.utmSessionSource,                    // attribution_session_source
  attribution.medium,                              // attribution_medium
  attribution.utmAdId,                             // attribution_ad_id << AQUÍ
  attribution.adName,                              // attribution_ad_name
  visitorId,
  created_at,
  updated_at
])
```

---

### FUENTE 4: TRACKING PIXEL (sesiones web)

**Archivo**: `/backend/src/services/trackingService.js` (línea 228-400)

**Función**: `createSession(sessionData)`

**IMPORTANTE**: El tracking pixel REGISTRA ad_id en la tabla `sessions`, NO en `contacts`.

**Cómo funciona**:
1. El pixel JavaScript del sitio del usuario captura visitas
2. Envía datos a `/collect` con parámetros de ads
3. Se crea un registro en tabla `sessions`

**Tabla sesiones guarda**:
```javascript
// Línea 304-366: Campos de ads en sessions
campaign_id,      // De data.campaign_id
adset_id,         // De data.adset_id
ad_group_id,      // De data.adgroupid
ad_id,            // De data.ad_id
campaign_name,    // De data.campaign_name o utm_campaign
adset_name,       // De data.adset_name
ad_group_name,    // De data.ad_group_name
ad_group_id,      // De data.ad_position
ad_name,          // De data.ad_name o utm_content
placement,        // De data.placement o site_source_name
site_source_name, // De data.site_source_name
```

**IMPORTANTE**: 
- El tracking pixel guarda `ad_id` en `sessions.ad_id`
- El webhook/sync guarda en `contacts.attribution_ad_id`
- Son campos separados

---

## 3. VINCULACIÓN ENTRE visitor_id Y contact_id

**Archivo**: `/backend/src/services/trackingService.js` (línea 404-459)

**Función**: `linkVisitorToContact(visitor_id, contact_id, full_name)`

**Cómo funciona** (se ejecuta en background):
1. Cuando un webhook de contacto llega con `rkvi_id` (visitor_id)
2. Se buscan todas las sesiones con ese visitor_id
3. Se actualiza contact_id en esas sesiones
4. Se guarda visitor_id en contacts.visitor_id

```javascript
// Línea 418-421: Actualiza sesiones históricas
UPDATE sessions SET contact_id = ?, full_name = ?, email = ?
WHERE visitor_id = ? AND contact_id IS NULL

// Línea 426-428: Guarda visitor_id en contacto
UPDATE contacts SET visitor_id = ?
WHERE id = ? AND visitor_id IS NULL
```

**Unificación de múltiples visitor_ids** (línea 617-689):
- Si un contacto tiene múltiples visitor_ids (ej: desktop + mobile)
- Unifica todos al más viejo (primera visita)

---

## 4. FALLBACK ATTRIBUTION SERVICE

**Archivo**: `/backend/src/services/attributionFallbackService.js`

**Función**: `executeFallbackAttribution()`

**Propósito**: Recuperar ad_id para contactos que tienen URL pero no tienen ad_id válido.

**Lógica**:
1. **Paso 1**: Construye mapeo URL → ad_id dominante
   - Busca contactos CON ad_id válido (existe en meta_ads)
   - Agrupa por URL
   - Si un ad_id tiene >80% de consenso en una URL → mapeo válido

2. **Paso 2**: Encuentra candidatos para fallback
   - Contactos CON attribution_url
   - PERO CON attribution_ad_id NULL, vacío, o no válido (no en meta_ads)

3. **Paso 3**: Para cada candidato
   - Busca el mapeo de su URL
   - Verifica que la fecha de creación del contacto esté en rango activo del ad
   - Si todo coincide → actualiza `attribution_ad_id`

**Línea clave** (159-160):
```javascript
UPDATE contacts SET attribution_ad_id = ? WHERE id = ?
[mappedAd.ad_id, contact.id]
```

---

## 5. RESUMEN: TODAS LAS FUENTES DE attribution_ad_id

| Fuente | Archivo | Función | Línea | Trigger | Campo HighLevel |
|--------|---------|---------|-------|---------|-----------------|
| **Webhook** | webhooksController.js | handleContactWebhook | 85 | Webhook POST /contact | utmAdId \| mediumId |
| **Sync Manual** | highlevelSyncService.js | syncHighLevelContacts | 556 | GET /contacts (paginated) | utmAdId |
| **Sync Citas** | highlevelSyncService.js | ensureContactExists | 447 | Si falta contacto en cita | utmAdId |
| **Fallback** | attributionFallbackService.js | executeFallbackAttribution | 159 | Manual API call | URL matching (80%+ consensus) |
| **Tracking** | trackingService.js | createSession | N/A | Pixel JavaScript | Guarda en sessions.ad_id, NO contacts |

---

## 6. ESTRUCTURA DE DATOS DE HIGHLEVEL

**Campo en HighLevel**: `contact.attributions` (array)

**Estructura de primer attribution**:
```javascript
{
  isFirst: true,
  utmAdId: "123456789",           // <-- MAPEA A contacts.attribution_ad_id
  mediumId: "987654321",          // <-- ALTERNATIVA si falta utmAdId
  adName: "Anuncio de Prueba",    // <-- MAPEA A contacts.attribution_ad_name
  pageUrl: "https://example.com", // <-- MAPEA A contacts.attribution_url
  url: "https://example.com",     // <-- ALTERNATIVA a pageUrl
  utmSessionSource: "facebook",   // <-- MAPEA A contacts.attribution_session_source
  medium: "cpc",                  // <-- MAPEA A contacts.attribution_medium
  // ... otros campos
}
```

---

## 7. CASOS ESPECIALES Y EDGE CASES

### Caso 1: Contact viene del webhook PERO sin attribution
```javascript
// webhook envía contact_id pero attribution vacío
// Resultado: attribution_ad_id = NULL
```

### Caso 2: Contact tiene visitor_id
```javascript
// webhook envía rkvi_id en custom field
// → linkVisitorToContact() busca sesiones con ese visitor_id
// → Actualiza contact_id en sesiones históricas
// PERO NO cambia attribution_ad_id (viene de HighLevel, no del tracking)
```

### Caso 3: Contacto con múltiples visitor_ids
```javascript
// Usuario entra desde desktop (visitor_1)
// Después desde mobile (visitor_2)
// Después se registra
// → unifyVisitorIds() unifica ambos al más viejo
```

### Caso 4: Fallback attribution filtra por fecha
```javascript
// Contacto creado 2025-10-20
// URL tiene mapeo a ad_id "123456"
// Ad "123456" estuvo activo: 2025-10-18 a 2025-10-25
// ✅ COINCIDE → se atribuye
// 
// Pero si ad estuvo activo: 2025-10-15 a 2025-10-19
// ❌ NO COINCIDE → se salta (date mismatch)
```

---

## 8. CAMPOS RELACIONADOS EN contacts TABLE

```
ATRIBUCIÓN:
├── attribution_ad_id         ← Campo clave investigado
├── attribution_ad_name
├── attribution_url
├── attribution_session_source
├── attribution_medium
└── attribution_ctwa_clid (WhatsApp specific)

TRACKING:
└── visitor_id               ← Vinculación con sessions

ESTADÍSTICAS:
├── total_paid
├── purchases_count
├── last_purchase_date
└── appointment_date
```

---

## 9. MÉTODOS PARA ACTUALIZAR attribution_ad_id

**1. Webhook** (automático, tiempo real)
- Endpoint: `POST /webhook/contact`
- Frecuencia: Cada vez que GHL envía webhook
- Requisito: HighLevel debe tener atribución configurada

**2. Sincronización manual** (bajo demanda)
- Endpoint: `POST /api/sync` o similar
- Frecuencia: Manual desde Settings del usuario
- Sincroniza TODOS los contactos

**3. Fallback attribution** (recuperación de datos)
- Endpoint: `POST /api/attribution/fallback/execute`
- Frecuencia: Manual desde Settings
- Solo toca contactos CON URL pero SIN ad_id válido

---

## 10. ARCHIVOS CLAVE RESUMIDOS

| Archivo | Responsabilidad |
|---------|-----------------|
| `database.js` | Schema de contacts con attribution_ad_id |
| `webhooksController.js` | Webhook recibe y asigna attribution_ad_id |
| `highlevelSyncService.js` | Sync manual + sync de citas asignan attribution_ad_id |
| `attributionFallbackService.js` | Recupera attribution_ad_id para contactos con URL |
| `trackingService.js` | Crea sesiones con ad_id, vincula visitor a contact |
| `attribution.routes.js` | Rutas para preview/execute fallback |
| `attributionController.js` | Endpoints de fallback attribution |

---

## CONCLUSIÓN

El flujo de `attribution_ad_id` es complejo pero bien organizado:

1. **Origen principal**: HighLevel `contact.attributions[0].utmAdId`
2. **Entrada**: Via webhook automático o sync manual
3. **Almacenamiento**: `contacts.attribution_ad_id` en PostgreSQL
4. **Recuperación**: Sistema fallback por URL matching (80%+ consenso)
5. **Vinculación visitor**: Separada (visitor_id → contact_id → attribution_ad_id)
6. **Caso especial**: Tracking pixel guarda ad_id en `sessions.ad_id`, no en contacts

Documento generado: 2025-10-26 por investigación completa del codebase.
