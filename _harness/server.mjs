import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' }

createServer(async (req, res) => {
  try {
    const path = req.url === '/' ? '/index.html' : req.url.split('?')[0]
    const buf = await readFile(join(root, path))
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' })
    res.end(buf)
  } catch {
    res.writeHead(404); res.end('not found')
  }
}).listen(4599, () => console.log('harness on http://localhost:4599'))
