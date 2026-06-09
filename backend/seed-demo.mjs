// Demo seed for Ristak local SQLite DB — populates contacts, payments,
// appointments, products, prices and costs with realistic, internally
// consistent data attributed to the real meta_ads already in the DB.
// Safe to re-run: it clears the demo tables first. Does NOT touch meta_ads.
import sqlite3Module from 'sqlite3'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const sqlite3 = sqlite3Module.default || sqlite3Module
const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '..', 'ristak.db')
const db = new sqlite3.Database(dbPath)

const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this) }))
const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))))

const id = () => crypto.randomBytes(16).toString('hex')

// deterministic RNG so re-runs are stable
let _s = 20260603
function rnd() { _s |= 0; _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const chance = (p) => rnd() < p
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

const CAL = 'rstk_cal_5c3bc79c-f19e-48cb-a794-dfeabfaaa44e'

// weighted day pool (heavier near the ad window 05-26..06-02)
const dayWeights = [
  ['2026-05-15', 1], ['2026-05-17', 1], ['2026-05-19', 1], ['2026-05-20', 2], ['2026-05-21', 2],
  ['2026-05-22', 2], ['2026-05-23', 3], ['2026-05-24', 2], ['2026-05-25', 3], ['2026-05-26', 4],
  ['2026-05-27', 5], ['2026-05-28', 6], ['2026-05-29', 6], ['2026-05-30', 5], ['2026-05-31', 4],
  ['2026-06-01', 6], ['2026-06-02', 6], ['2026-06-03', 3],
]
const dayPool = dayWeights.flatMap(([d, w]) => Array(w).fill(d))
const pad = (n) => String(n).padStart(2, '0')
const at = (day, hLo = 8, hHi = 20) => `${day} ${pad(int(hLo, hHi))}:${pad(int(0, 59))}:00`
const futureDay = () => pick(['2026-06-04', '2026-06-05', '2026-06-06', '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11'])
const addMin = (tsStr, mins) => {
  const d = new Date(tsStr.replace(' ', 'T') + 'Z'); d.setUTCMinutes(d.getUTCMinutes() + mins)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`
}

// Real ads (ad_id, ad_name) weighted by spend
const ADS = [
  ['120241691100910604', 'Video 1 - Video Error', 10], ['120225590858810604', 'Testimonio - Omar Mora', 6],
  ['120219886565770604', 'Testimonio - Alejandra', 6], ['120240643391650604', 'Educativo 3 - Versión 2', 5],
  ['120240643391810604', 'Educativo 3', 5], ['120220523020350604', 'Testimonio - Maritere', 5],
  ['120239700060860604', 'Alexis Delgado', 4], ['120240643391440604', 'Noticia 3', 4],
  ['120228697377650604', 'Testimonio - Carlos Serrano', 3], ['120219886261250604', 'Testimonio - Elba Pelayo', 3],
  ['120229683949740604', 'Testimonio - Tania Salinas', 3], ['120240643391520604', 'Noticia 2', 2],
  ['120240873103610604', 'Educativo 18', 2], ['120241690958220604', 'Educativo 19', 2],
  ['120240643391770604', 'En el bosque colomos', 2], ['120246237616080604', 'Educativo 20', 1],
  ['120246242877220604', 'Educativo 21', 1], ['120247082060770604', 'Educativo 22', 1], ['120247083056520604', 'Educativo 23', 1],
]
const adPool = ADS.flatMap(([i, n, w]) => Array(w).fill([i, n]))
const methods = ['card', 'transfer', 'spei', 'cash']

const FIRST = ['Sofía', 'Mateo', 'Valentina', 'Santiago', 'Regina', 'Diego', 'Camila', 'Emiliano', 'Ximena', 'Leonardo', 'Renata', 'Sebastián', 'Victoria', 'Maximiliano', 'Fernanda', 'Daniel', 'Andrea', 'Alejandro', 'Mariana', 'Rodrigo', 'Paola', 'Gabriel', 'Isabela', 'Héctor', 'Lucía', 'Adrián', 'Daniela', 'Iván', 'Carolina', 'Roberto', 'Brenda', 'Óscar', 'Gabriela', 'Arturo', 'Mónica', 'Raúl', 'Patricia', 'Jorge', 'Verónica', 'Eduardo']
const LAST = ['García', 'Hernández', 'Martínez', 'López', 'González', 'Rodríguez', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Reyes', 'Cruz', 'Morales', 'Ortiz', 'Gutiérrez', 'Mendoza', 'Castillo', 'Vázquez', 'Romero', 'Álvarez', 'Jiménez', 'Ruiz', 'Delgado', 'Aguilar', 'Medina', 'Vega']
const FEATURED = [['Omar', 'Mora'], ['Alejandra', 'Ríos'], ['Carlos', 'Serrano'], ['Elba', 'Pelayo'], ['María Teresa', 'Luna'], ['Tania', 'Salinas'], ['Alexis', 'Delgado'], ['Maritere', 'Quezada']]

const PRODUCTS = [
  { name: 'Programa Médicos de Alto Valor', amount: 34900, ptype: 'DIGITAL', recurring: false, desc: 'Programa insignia para llenar la agenda con pacientes de alto valor.' },
  { name: 'Mentoría Captación de Pacientes', amount: 18500, ptype: 'DIGITAL', recurring: false, desc: 'Mentoría grupal de 8 semanas para escalar citas con anuncios.' },
  { name: 'Setup de Anuncios para Clínicas', amount: 12000, ptype: 'PHYSICAL', recurring: false, desc: 'Implementación completa de campañas de Meta Ads y tracking.' },
  { name: 'Plan Mensual Gestión de Anuncios', amount: 9900, ptype: 'PHYSICAL', recurring: true, desc: 'Gestión mensual de campañas, creativos y reportes de resultados.' },
]

async function main() {
  await run('PRAGMA foreign_keys = ON')

  // reset password for screenshots
  await run('UPDATE users SET password_hash = ?, full_name = ?, email = ? WHERE id = 1', [hashPassword('ristak2026'), 'Raúl Gómez', 'admin@ristak.mx'])

  // clear demo tables (meta_ads, users, config untouched)
  for (const t of ['payments', 'appointments', 'product_prices', 'products', 'costs', 'contacts']) {
    await run(`DELETE FROM ${t}`)
  }

  // products + prices
  for (const p of PRODUCTS) {
    const pid = id()
    await run(`INSERT INTO products (id, location_id, name, description, product_type, currency, is_active, source, sync_status) VALUES (?,?,?,?,?,?,1,'ristak','synced')`,
      [pid, 'rstk', p.name, p.desc, p.ptype, 'MXN'])
    await run(`INSERT INTO product_prices (id, product_id, location_id, name, type, currency, amount, description, interval, interval_count, is_digital_product, source, sync_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,'ristak','synced')`,
      [id(), pid, 'rstk', p.recurring ? 'Mensual' : 'Pago único', p.recurring ? 'recurring' : 'one_time', 'MXN', p.amount, p.desc, p.recurring ? 'month' : null, p.recurring ? 1 : null, p.ptype === 'DIGITAL' ? 1 : 0])
  }

  // costs
  const COSTS = [
    ['Comisión de cierre', 'commission', 'percentage', 10, 'revenue'],
    ['Honorarios del closer', 'commission', 'percentage', 5, 'profit'],
    ['Gestión de anuncios y creativos', 'service', 'fixed', 12000, ''],
    ['Herramientas y software', 'service', 'fixed', 3800, ''],
    ['Renta de oficina', 'rent', 'fixed', 9500, ''],
  ]
  for (const [name, type, calc, value, applies] of COSTS) {
    await run(`INSERT INTO costs (id, name, type, calculation_type, value, applies_to, is_active) VALUES (?,?,?,?,?,?,1)`,
      [id(), name, type, calc, value, applies])
  }

  // contacts
  const usedPhone = new Set(), usedEmail = new Set(), usedName = new Set()
  const domains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.mx']
  const contacts = []
  const N = 56
  let emailN = 1
  for (let i = 0; i < N; i++) {
    let fn, ln
    if (i < FEATURED.length) { [fn, ln] = FEATURED[i] }
    else {
      do { fn = pick(FIRST); ln = `${pick(LAST)} ${pick(LAST)}` } while (usedName.has(fn + ln))
    }
    usedName.add(fn + ln)
    let phone; do { phone = `+52${int(55, 81)}${int(10000000, 99999999)}` } while (usedPhone.has(phone)); usedPhone.add(phone)
    let email; do { email = `${slug(fn)}.${slug(ln.split(' ')[0])}${emailN++}@${pick(domains)}` } while (usedEmail.has(email)); usedEmail.add(email)

    // attribution bucket
    const r = rnd()
    let source, sess, medium, adId = null, adName = null, ctwa = null, url = null
    if (r < 0.45) { // Meta paid (feed)
      ;[adId, adName] = pick(adPool); source = 'Meta Ads'; sess = chance(0.6) ? 'Facebook' : 'Instagram'; medium = 'paid_social'; url = 'https://www.facebook.com/'
    } else if (r < 0.68) { // Click to WhatsApp from ad
      ;[adId, adName] = pick(adPool); source = 'WhatsApp'; sess = 'Facebook'; medium = 'ctwa'; ctwa = `Af${crypto.randomBytes(8).toString('hex')}`; url = 'https://wa.me/'
    } else if (r < 0.82) { source = 'Instagram'; sess = 'Instagram'; medium = 'organic'; url = 'https://www.instagram.com/' }
    else if (r < 0.92) { source = 'Google'; sess = 'Google'; medium = 'organic'; url = 'https://www.google.com/' }
    else { source = chance(0.5) ? 'Referido' : 'Directo'; sess = 'Directo'; medium = 'referral' }

    const created = at(pick(dayPool))
    const c = { id: id(), fn, ln, full: `${fn} ${ln}`, phone, email, source, sess, medium, adId, adName, ctwa, url, created }
    contacts.push(c)
    await run(`INSERT INTO contacts (id, phone, email, full_name, first_name, last_name, source, visitor_id, attribution_url, attribution_session_source, attribution_medium, attribution_ctwa_clid, attribution_ad_name, attribution_ad_id, created_at, updated_at, custom_fields) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, '[]')`,
      [c.id, phone, email, c.full, fn, ln, source, `vis_${crypto.randomBytes(6).toString('hex')}`, url, sess, medium, ctwa, adName, adId, created, created])
  }

  // buyers: bias toward ad-attributed contacts
  const adContacts = contacts.filter(c => c.adId)
  const otherContacts = contacts.filter(c => !c.adId)
  const buyers = []
  for (const c of adContacts) { if (buyers.length < 9 && chance(0.55)) buyers.push(c) }
  for (const c of otherContacts) { if (buyers.length < 13 && chance(0.3)) buyers.push(c) }

  // payments
  let inv = 1
  const invNo = () => `RST-2026-${pad(inv++).padStart(4, '0')}`
  let revenue = 0
  for (const c of buyers) {
    const prod = pick(PRODUCTS.flatMap(p => Array(p.amount >= 34000 ? 1 : p.amount >= 18000 ? 2 : 4).fill(p)))
    const amount = prod.amount
    const day = c.created
    const installments = amount >= 30000 && chance(0.6) ? 2 : 1
    if (installments === 2) {
      const a1 = Math.round(amount * 0.5)
      const a2 = amount - a1
      await mkPayment(c, a1, 'succeeded', prod, day, invNo()); revenue += a1
      const secondDay = at('2026-06-0' + int(1, 2))
      if (chance(0.7)) { await mkPayment(c, a2, 'succeeded', prod, secondDay, invNo()); revenue += a2 }
      else { await mkPayment(c, a2, 'pending', prod, secondDay, invNo()) }
    } else {
      await mkPayment(c, amount, 'succeeded', prod, day, invNo()); revenue += amount
    }
  }
  // a few standalone pending invoices for non-buyers (populate Pagos)
  for (const c of otherContacts.filter(c => !buyers.includes(c)).slice(0, 6)) {
    if (chance(0.6)) { const prod = pick(PRODUCTS); await mkPayment(c, prod.amount, 'pending', prod, at(pick(dayPool)), invNo()) }
  }

  // appointments
  const apptContacts = [...new Set([...buyers, ...contacts.filter(() => chance(0.4))])].slice(0, 34)
  for (const c of apptContacts) {
    const isBuyer = buyers.includes(c)
    let status
    const r = rnd()
    if (isBuyer) status = r < 0.8 ? 'showed' : (r < 0.9 ? 'confirmed' : 'noshow')
    else status = r < 0.32 ? 'confirmed' : r < 0.62 ? 'showed' : r < 0.82 ? 'noshow' : 'cancelled'
    const start = status === 'confirmed' ? `${futureDay()} ${pad(int(9, 17))}:00:00` : at(c.created, 9, 18)
    const end = addMin(start, 60)
    const aid = id()
    await run(`INSERT INTO appointments (id, calendar_id, contact_id, location_id, title, status, appointment_status, notes, start_time, end_time, date_added, date_updated, source, sync_status, synced_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'ristak','synced',?)`,
      [aid, CAL, c.id, 'rstk', 'Llamada de diagnóstico', status === 'confirmed' ? 'confirmed' : 'booked', status, isBuyer ? 'Cliente cerrado en la llamada.' : 'Lead agendado desde anuncio.', start, end, c.created, c.created, c.created])
    await run(`UPDATE contacts SET appointment_date = ? WHERE id = ?`, [start, c.id])
  }

  // ---- prior period (April) for natural period-over-period deltas ----
  const aprilDays = ['2026-04-06', '2026-04-09', '2026-04-12', '2026-04-15', '2026-04-18', '2026-04-21', '2026-04-24', '2026-04-27', '2026-04-30', '2026-05-02']
  for (let i = 0; i < 13; i++) {
    let fn = pick(FIRST), ln = `${pick(LAST)} ${pick(LAST)}`
    if (usedName.has(fn + ln)) { ln = `${pick(LAST)} ${pick(LAST)}` }
    usedName.add(fn + ln)
    let phone; do { phone = `+52${int(55, 81)}${int(10000000, 99999999)}` } while (usedPhone.has(phone)); usedPhone.add(phone)
    let email; do { email = `${slug(fn)}.${slug(ln.split(' ')[0])}${emailN++}@${pick(domains)}` } while (usedEmail.has(email)); usedEmail.add(email)
    const day = pick(aprilDays)
    const created = `${day} ${pad(int(8, 20))}:${pad(int(0, 59))}:00`
    const cid = id()
    const src = pick(['Instagram', 'Google', 'Referido', 'Meta Ads', 'WhatsApp'])
    await run(`INSERT INTO contacts (id, phone, email, full_name, first_name, last_name, source, visitor_id, attribution_session_source, attribution_medium, created_at, updated_at, custom_fields) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, '[]')`,
      [cid, phone, email, `${fn} ${ln}`, fn, ln, src, `vis_${crypto.randomBytes(6).toString('hex')}`, src, 'organic', created, created])
    if (i < 6) {
      const prod = pick(PRODUCTS.filter(p => p.amount <= 18500))
      await run(`INSERT INTO payments (id, contact_id, amount, currency, status, payment_method, reference, description, title, date, payment_mode, invoice_number, sent_at) VALUES (?,?,?,?,?,?,?,?,?,?, 'live', ?, ?)`,
        [id(), cid, prod.amount, 'MXN', 'succeeded', pick(methods), `ch_${crypto.randomBytes(8).toString('hex')}`, prod.desc, prod.name, created, `RST-2026-${pad(inv++).padStart(4, '0')}`, created])
    }
    if (chance(0.6)) {
      const start = `${day} ${pad(int(9, 17))}:00:00`
      await run(`INSERT INTO appointments (id, calendar_id, contact_id, location_id, title, status, appointment_status, start_time, end_time, date_added, date_updated, source, sync_status, synced_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, 'ristak','synced',?)`,
        [id(), CAL, cid, 'rstk', 'Llamada de diagnóstico', 'booked', pick(['showed', 'showed', 'noshow', 'cancelled']), start, addMin(start, 60), created, created, created])
    }
  }

  // roll up contact financials
  await run(`UPDATE contacts SET
      total_paid = COALESCE((SELECT SUM(amount) FROM payments WHERE payments.contact_id = contacts.id AND status='succeeded'), 0),
      purchases_count = COALESCE((SELECT COUNT(*) FROM payments WHERE payments.contact_id = contacts.id AND status='succeeded'), 0),
      last_purchase_date = (SELECT MAX(date) FROM payments WHERE payments.contact_id = contacts.id AND status='succeeded')`)

  const cc = await get('SELECT COUNT(*) n FROM contacts')
  const pc = await get(`SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM payments WHERE status='succeeded'`)
  const ac = await get('SELECT COUNT(*) n FROM appointments')
  console.log(`✅ Seed listo: ${cc.n} contactos, ${pc.n} pagos cobrados ($${Math.round(pc.s).toLocaleString('es-MX')} MXN), ${ac.n} citas, ${buyers.length} clientes`)
  db.close()
}

async function mkPayment(c, amount, status, prod, date, invoiceNumber) {
  await run(`INSERT INTO payments (id, contact_id, amount, currency, status, payment_method, reference, description, title, date, payment_mode, invoice_number, sent_at) VALUES (?,?,?,?,?,?,?,?,?,?, 'live', ?, ?)`,
    [id(), c.id, amount, 'MXN', status, pick(methods), `ch_${crypto.randomBytes(8).toString('hex')}`, prod.desc, prod.name, date, invoiceNumber, date])
}

main().catch((e) => { console.error('❌ Seed error:', e); process.exit(1) })
