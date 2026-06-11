import test from 'node:test'
import assert from 'node:assert/strict'
import { AGENT_CATEGORIES, getAgentCategory, listAgentCategories } from '../src/agents/registry.js'
import { invokeController, toToolResult } from '../src/agents/invokeController.js'

const EXPECTED_CATEGORIES = ['citas', 'pagos', 'redes', 'anuncios', 'contactos', 'costos', 'general']

test('el registro tiene las 7 especialidades esperadas', () => {
  assert.deepEqual(AGENT_CATEGORIES.map((category) => category.id), EXPECTED_CATEGORIES)
})

test('cada especialidad define label, descripción, instrucciones y herramientas', () => {
  for (const category of AGENT_CATEGORIES) {
    assert.ok(category.label, `${category.id} sin label`)
    assert.ok(category.description, `${category.id} sin descripción`)
    assert.ok(typeof category.instructions === 'string' && category.instructions.length > 50, `${category.id} sin instrucciones`)
    assert.ok(Array.isArray(category.tools) && category.tools.length > 0, `${category.id} sin herramientas`)
  }
})

test('las herramientas de cada especialidad tienen nombres únicos', () => {
  for (const category of AGENT_CATEGORIES) {
    const names = category.tools.map((tool) => tool.name)
    assert.equal(new Set(names).size, names.length, `Herramientas duplicadas en ${category.id}: ${names.join(', ')}`)
  }
})

test('cada especialidad tiene memoria propia (save_memory y forget_memory)', () => {
  for (const category of AGENT_CATEGORIES) {
    const names = category.tools.map((tool) => tool.name)
    assert.ok(names.includes('save_memory'), `${category.id} sin save_memory`)
    assert.ok(names.includes('forget_memory'), `${category.id} sin forget_memory`)
  }
})

test('los agentes especializados NO mezclan herramientas de otros dominios', () => {
  const toolNames = (id) => getAgentCategory(id).tools.map((tool) => tool.name)

  assert.ok(!toolNames('citas').includes('record_payment'), 'citas no debe registrar pagos')
  assert.ok(!toolNames('citas').includes('create_cost'), 'citas no debe tocar costos')
  assert.ok(!toolNames('pagos').includes('create_appointment'), 'pagos no debe agendar citas')
  assert.ok(!toolNames('anuncios').includes('delete_contact'), 'anuncios no debe borrar contactos')
  assert.ok(!toolNames('costos').includes('search_contacts'), 'costos no necesita contactos')
  assert.ok(!toolNames('contactos').includes('get_ads_metrics'), 'contactos no debe ver métricas de ads')
})

test('el agente general sí tiene acceso a todos los dominios', () => {
  const names = getAgentCategory('general').tools.map((tool) => tool.name)
  for (const required of ['create_appointment', 'record_payment', 'create_contact', 'create_cost', 'get_ads_metrics', 'list_social_profiles']) {
    assert.ok(names.includes(required), `general sin ${required}`)
  }
})

test('getAgentCategory normaliza y rechaza categorías inválidas', () => {
  assert.equal(getAgentCategory('  CITAS  ').id, 'citas')
  assert.equal(getAgentCategory('inexistente'), null)
  assert.equal(getAgentCategory(''), null)
  assert.equal(getAgentCategory(null), null)
})

test('listAgentCategories expone solo los campos públicos', () => {
  for (const category of listAgentCategories()) {
    assert.deepEqual(Object.keys(category).sort(), ['description', 'icon', 'id', 'label'])
  }
})

test('invokeController captura status y payload del controller', async () => {
  const fakeHandler = async (req, res) => {
    if (!req.body.name) {
      return res.status(400).json({ success: false, error: 'Falta nombre' })
    }
    res.status(201).json({ success: true, data: { id: 'x1', name: req.body.name } })
  }

  const okResult = await invokeController(fakeHandler, { body: { name: 'Ana' } })
  assert.equal(okResult.statusCode, 201)
  assert.deepEqual(toToolResult(okResult), { ok: true, statusCode: 201, data: { id: 'x1', name: 'Ana' } })

  const errorResult = await invokeController(fakeHandler, { body: {} })
  assert.equal(errorResult.statusCode, 400)
  assert.deepEqual(toToolResult(errorResult), { ok: false, statusCode: 400, error: 'Falta nombre' })
})

test('invokeController propaga excepciones del controller', async () => {
  const throwingHandler = async () => {
    throw new Error('boom')
  }
  await assert.rejects(() => invokeController(throwingHandler), /boom/)
})
