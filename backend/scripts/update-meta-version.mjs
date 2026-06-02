import 'dotenv/config'
import { forceMetaVersionUpdate } from '../src/jobs/metaVersionCron.js'

const source = process.env.GITHUB_ACTIONS ? 'github-actions' : 'script'
const result = await forceMetaVersionUpdate(source)

console.log(JSON.stringify(result, null, 2))

process.exit(result.error ? 1 : 0)
