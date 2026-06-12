import test from 'node:test'
import assert from 'node:assert/strict'
import { db } from '../src/config/database.js'
import {
  createAutomation,
  getAutomation,
  updateAutomation
} from '../src/services/automationsService.js'

function makeFlow(label = 'Mensaje publicado', viewport = { x: 0, y: 0, zoom: 1 }) {
  return {
    nodes: [
      {
        id: 'start',
        type: 'start',
        category: 'trigger',
        label: 'Cuando...',
        position: { x: 120, y: 220 },
        config: {
          triggers: [{ id: 'trig_test', type: 'trigger-contact-created', config: {} }]
        }
      },
      {
        id: 'node_message',
        type: 'action-send-message',
        label: 'Mensaje',
        position: { x: 520, y: 220 },
        config: { customTitle: label }
      }
    ],
    edges: [
      {
        id: 'edge_test',
        sourceNodeId: 'start',
        sourceHandle: 'out',
        targetNodeId: 'node_message',
        targetHandle: 'in',
        animated: true
      }
    ],
    viewport,
    settings: { allowReentry: true, preventDuplicateActiveEnrollment: true }
  }
}

test('updateAutomation separa borrador guardado de flujo publicado', async () => {
  const automation = await createAutomation({
    name: `Publicación con borrador ${Date.now()}`,
    flow: makeFlow('Versión viva')
  })

  try {
    const published = await updateAutomation(automation.id, { status: 'published' })
    assert.equal(published.status, 'published')
    assert.equal(published.hasUnpublishedChanges, false)

    const movedViewport = await updateAutomation(automation.id, {
      flow: makeFlow('Versión viva', { x: 200, y: -40, zoom: 0.8 })
    })
    assert.equal(movedViewport.hasUnpublishedChanges, false)

    const draftSaved = await updateAutomation(automation.id, {
      flow: makeFlow('Cambio pendiente')
    })
    assert.equal(draftSaved.status, 'published')
    assert.equal(draftSaved.hasUnpublishedChanges, true)

    const rowWithDraft = await db.get('SELECT flow, published_flow FROM automations WHERE id = ?', [automation.id])
    assert.match(String(rowWithDraft.flow), /Cambio pendiente/)
    assert.match(String(rowWithDraft.published_flow), /Versión viva/)

    const republished = await updateAutomation(automation.id, { status: 'published' })
    assert.equal(republished.hasUnpublishedChanges, false)

    const fresh = await getAutomation(automation.id)
    assert.equal(fresh.hasUnpublishedChanges, false)
    assert.equal(fresh.flow.nodes[1].config.customTitle, 'Cambio pendiente')
  } finally {
    await db.run('DELETE FROM automations WHERE id = ?', [automation.id])
  }
})
