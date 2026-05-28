# Servicio Backend De Calendarios HighLevel

Documentación del módulo backend actual:

- `backend/src/services/highlevelCalendarService.js`
- `backend/src/controllers/calendarsController.js`
- `backend/src/routes/calendars.routes.js`

## API Externa

- Base URL: `https://services.leadconnectorhq.com`
- Header Version: `2021-04-15`
- Auth: `Authorization: Bearer <accessToken>`
- Timeout local por request: 15 segundos

## Rutas Backend

Montadas en `server.js` como:

```javascript
app.use('/api/calendars', calendarsRoutes)
```

| Método | Ruta | Controlador |
| --- | --- | --- |
| GET | `/api/calendars` | `getCalendars` |
| GET | `/api/calendars/events` | `getEvents` |
| GET | `/api/calendars/events/:eventId` | `getAppointment` |
| POST | `/api/calendars/appointments` | `createAppointment` |
| PUT | `/api/calendars/appointments/:id` | `updateAppointment` |
| DELETE | `/api/calendars/events/:id` | `deleteEvent` |
| GET | `/api/calendars/:id/free-slots` | `getFreeSlots` |
| GET | `/api/calendars/:calendarId/blocked-slots` | `getBlockedSlots` |
| POST | `/api/calendars/block-slots` | `createBlockedSlot` |
| PUT | `/api/calendars/block-slots/:id` | `updateBlockedSlot` |
| DELETE | `/api/calendars/block-slots/:id` | `deleteBlockedSlot` |
| GET | `/api/calendars/:id` | `getCalendar` |
| PUT | `/api/calendars/:id` | `updateCalendar` |

El orden importa: rutas específicas como `/events` y `/block-slots` van antes de `/:id`.

## Funciones Del Servicio

### `getCalendars(locationId, accessToken)`

Lista calendarios por location.

### `getCalendar(calendarId, accessToken)`

Obtiene detalle de un calendario.

### `getCalendarEvents(locationId, startTime, endTime, accessToken, calendarId = null)`

Lista eventos/citas por rango en timestamp ms. `calendarId` es opcional.

### `getAppointment(eventId, accessToken)`

Obtiene detalle de una cita. El controlador usa `ghlClient` para este endpoint porque ya tiene token configurado.

### `getFreeSlots(calendarId, startDate, endDate, accessToken, timezone = 'America/Mexico_City')`

Obtiene slots disponibles.

### `getBlockedSlots(locationId, startTime, endTime, accessToken, calendarId = null, calendar = null)`

Obtiene horarios bloqueados. Si el controlador tiene `calendarId`, primero intenta cargar el calendario para pasar `teamMembers`.

### `createBlockedSlot(blockData, locationId, accessToken)`

Crea un bloque de calendario. La API de HighLevel usa una lógica exclusiva:

- `calendarId` sin `assignedUserId`: bloquea todo el calendario.
- `assignedUserId` sin `calendarId`: bloquea a un usuario.

### `updateBlockedSlot(eventId, updateData, accessToken)`

Actualiza un blocked slot.

### `deleteBlockedSlot(eventId, accessToken)`

Elimina un blocked slot.

### `createAppointment(appointmentData, locationId, accessToken)`

Crea una cita. El servicio mapea estados no soportados por HighLevel:

- `pending` -> `confirmed`
- `rescheduled` -> `confirmed`

### `updateAppointment(eventId, updateData, accessToken)`

Actualiza una cita.

### `deleteEvent(eventId, accessToken)`

Elimina una cita/evento.

### `updateCalendar(calendarId, updateData, accessToken)`

Actualiza configuración de calendario.

## Respuestas Del Controller

Los endpoints devuelven normalmente:

```json
{
  "success": true,
  "data": {}
}
```

`apiClient.ts` extrae automáticamente `data` cuando la respuesta incluye `{ success, data }`.

## Requisitos

El frontend obtiene `locationId` y `accessToken` desde `AuthContext`, que a su vez consulta:

```http
GET /api/integrations/status
```

Para que calendarios funcionen:

- HighLevel debe estar configurado en Settings.
- El token debe tener permisos para calendarios, eventos, usuarios y citas.
- Para productos/pagos relacionados, algunos flujos requieren scopes adicionales fuera de este módulo.

## Errores Comunes

- 400 desde controller: faltan `locationId`, `accessToken`, `startTime`, etc.
- 401/403 desde HighLevel: token inválido o scopes insuficientes.
- 404: calendario/evento inexistente.
- 429: rate limit de HighLevel.
- Timeout local: request excedió 15 segundos.

## Archivos Relacionados

Frontend:

- `frontend/src/pages/Appointments/Appointments.tsx`
- `frontend/src/services/calendarsService.ts`
- `frontend/src/components/common/AppointmentModal/AppointmentModal.tsx`
- `frontend/src/components/common/BlockedSlotModal/BlockedSlotModal.tsx`

Config:

- `frontend/src/pages/Settings/CalendarsConfiguration.tsx`
- `app_config.default_calendar_id`
- `app_config.attribution_calendar_ids`

## Referencias

- [HighLevel Calendars](https://marketplace.gohighlevel.com/docs/ghl/calendars/calendars)
- [HighLevel Calendar Events](https://marketplace.gohighlevel.com/docs/ghl/calendars/calendar-events)
