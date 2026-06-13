import test from 'node:test'
import assert from 'node:assert/strict'

import { db, getAppConfig, setAppConfig } from '../src/config/database.js'
import { createBlock, createSite, createSubmissionFromRequest, deleteSite } from '../src/services/sitesService.js'
import { parseContactCustomFields } from '../src/utils/contactCustomFields.js'

const DOMAIN_KEYS = {
  domain: 'sites_public_domain',
  verified: 'sites_public_domain_verified',
  checkedAt: 'sites_public_domain_checked_at',
  error: 'sites_public_domain_error'
}

test('native form system fields save to contact and locked system fields', async () => {
  const previousConfig = {
    domain: await getAppConfig(DOMAIN_KEYS.domain),
    verified: await getAppConfig(DOMAIN_KEYS.verified),
    checkedAt: await getAppConfig(DOMAIN_KEYS.checkedAt),
    error: await getAppConfig(DOMAIN_KEYS.error)
  }
  const previousCityDefinition = await db.get(
    'SELECT id FROM contact_custom_field_definitions WHERE field_key = ? LIMIT 1',
    ['city']
  )
  const email = `ana-system-${Date.now()}@example.test`
  let site

  try {
    await setAppConfig(DOMAIN_KEYS.domain, 'example.test')
    await setAppConfig(DOMAIN_KEYS.verified, '1')
    await setAppConfig(DOMAIN_KEYS.checkedAt, new Date().toISOString())
    await setAppConfig(DOMAIN_KEYS.error, '')

    site = await createSite({
      name: 'Formulario campos sistema',
      slug: `form-system-${Date.now()}`,
      siteType: 'standard_form',
      status: 'published',
      blankCanvas: true
    })

    await createBlock(site.id, {
      blockType: 'short_text',
      label: 'Primer nombre',
      placeholder: 'Tu primer nombre',
      required: true,
      settings: { systemFieldKey: 'first_name', internalName: 'first_name' }
    })
    await createBlock(site.id, {
      blockType: 'email',
      label: 'Correo electronico',
      placeholder: 'tu@email.com',
      required: true,
      settings: { systemFieldKey: 'email', internalName: 'email', validation: 'email' }
    })
    const siteWithCity = await createBlock(site.id, {
      blockType: 'short_text',
      label: 'Ciudad',
      placeholder: 'Tu ciudad',
      required: false,
      settings: { systemFieldKey: 'city', internalName: 'city', customFieldDataType: 'text' }
    })

    const blocks = siteWithCity.blocks || []
    const firstNameBlock = blocks.find(block => block.settings?.systemFieldKey === 'first_name')
    const emailBlock = blocks.find(block => block.settings?.systemFieldKey === 'email')
    const cityBlock = blocks.find(block => block.settings?.systemFieldKey === 'city')

    assert.ok(firstNameBlock)
    assert.ok(emailBlock)
    assert.ok(cityBlock)

    const result = await createSubmissionFromRequest(
      {
        headers: { host: 'example.test', 'user-agent': 'node-test' },
        hostname: 'example.test',
        path: `/${site.slug}`,
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' }
      },
      {
        siteId: site.id,
        finalSubmit: true,
        responses: {
          [firstNameBlock.id]: 'Ana',
          [emailBlock.id]: email,
          [cityBlock.id]: 'CDMX'
        }
      }
    )

    assert.ok(result.contactId)
    assert.equal(result.mappedFields.standard.first_name, 'Ana')
    assert.equal(result.mappedFields.standard.email, email)
    assert.equal(result.mappedFields.system.city, 'CDMX')
    assert.equal(result.mappedFields.custom?.city, undefined)
    assert.equal(result.derivedFields.full_name, 'Ana')

    const contact = await db.get(
      'SELECT email, full_name, first_name, custom_fields FROM contacts WHERE id = ?',
      [result.contactId]
    )
    assert.equal(contact.email, email)
    assert.equal(contact.full_name, 'Ana')
    assert.equal(contact.first_name, 'Ana')

    const customFields = parseContactCustomFields(contact.custom_fields)
    const cityField = customFields.find(field => field.fieldKey === 'city')
    assert.equal(cityField?.value, 'CDMX')
    assert.equal(cityField?.sourceType, 'system')
    assert.equal(cityField?.syncTarget, 'none')

    const cityDefinition = await db.get(
      'SELECT field_key, source_type, sync_target FROM contact_custom_field_definitions WHERE field_key = ? LIMIT 1',
      ['city']
    )
    assert.equal(cityDefinition.field_key, 'city')
    assert.equal(cityDefinition.source_type, 'system')
    assert.equal(cityDefinition.sync_target, 'none')
  } finally {
    if (site?.id) {
      await deleteSite(site.id).catch(() => undefined)
    }
    await db.run('DELETE FROM contacts WHERE email = ?', [email]).catch(() => undefined)
    if (!previousCityDefinition?.id) {
      const cityDefinition = await db.get(
        'SELECT id FROM contact_custom_field_definitions WHERE field_key = ? LIMIT 1',
        ['city']
      )
      if (cityDefinition?.id) {
        await db.run('DELETE FROM contact_custom_field_definition_sources WHERE definition_id = ?', [cityDefinition.id]).catch(() => undefined)
        await db.run('DELETE FROM contact_custom_field_definitions WHERE id = ?', [cityDefinition.id]).catch(() => undefined)
      }
    }
    await setAppConfig(DOMAIN_KEYS.domain, previousConfig.domain)
    await setAppConfig(DOMAIN_KEYS.verified, previousConfig.verified)
    await setAppConfig(DOMAIN_KEYS.checkedAt, previousConfig.checkedAt)
    await setAppConfig(DOMAIN_KEYS.error, previousConfig.error)
  }
})
