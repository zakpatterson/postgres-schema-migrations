import {BasicPgClient, Logger} from "./types"

const DUPLICATE_DATABASE = "42P04"

export function runCreateQuery(dbName: string, log: Logger) {
  return async (client: BasicPgClient): Promise<void> => {
    await client
      .query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`)
      .catch((e) => {
        switch (e.code) {
          case DUPLICATE_DATABASE: {
            log(`'${dbName}' database already exists`)
            return
          }

          default: {
            log(e)
            throw new Error(
              `Error creating database. Caused by: '${e.name}: ${e.message}'`,
            )
          }
        }
      })
  }
}
