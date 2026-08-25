// Instância única do Drizzle, cacheada globalmente para não reabrir conexões
// a cada hot-reload do Next.js em dev.

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var __dbClient: postgres.Sql | undefined
}

const client = global.__dbClient ?? postgres(process.env.DATABASE_URL!)

if (process.env.NODE_ENV !== 'production') {
  global.__dbClient = client
}

export const db = drizzle(client, { schema })
