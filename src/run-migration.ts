import SQL from "sql-template-strings"
import {Logger, Migration, BasicPgClient} from "./types"

const noop = (): void => {
  //
}

const asyncNoop = (): Promise<void> => Promise.resolve()

const insertMigration = async (
  migrationTableName: string,
  client: BasicPgClient,
  migration: Migration,
  log: Logger,
) => {
  log(
    `Saving migration to '${migrationTableName}': ${migration.id} | ${migration.name} | ${migration.hash}`,
  )

  const sql = SQL`INSERT INTO `
    .append(migrationTableName)
    .append(
      SQL` ("id", "name", "hash") VALUES (${migration.id},${migration.name},${migration.hash})`,
    )

  return client.query(sql)
}

export const runMigration =
  (migrationTableName: string, client: BasicPgClient, log: Logger = noop) =>
  async (migration: Migration) => {
    const inTransaction =
      migration.sql.includes("-- postgres-migrations disable-transaction") ===
      false

    log(`Running migration in transaction: ${inTransaction}`)

    const begin = inTransaction
      ? () => client.query("START TRANSACTION")
      : asyncNoop

    const end = inTransaction ? () => client.query("COMMIT") : asyncNoop

    const cleanup = inTransaction ? () => client.query("ROLLBACK") : asyncNoop

    try {
      await begin()
      await client.query(migration.sql)
      log("Ran migration " + migration.fileName)
      await insertMigration(migrationTableName, client, migration, log)
      log("inserted migration in migrations table" + migrationTableName)
      end()

      return migration
    } catch (err: unknown) {
      try {
        await cleanup()
      } catch {
        //
      }
      if (err instanceof Error) {
        throw new Error(
          `An error occurred running '${migration.name}'. Rolled back this migration. No further migrations were run. Reason: ${err.message}`,
        )
      }
      throw err
    }
  }
