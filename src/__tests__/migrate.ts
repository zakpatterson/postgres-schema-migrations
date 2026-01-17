import test from "ava"
import * as pg from "pg"
import SQL from "sql-template-strings"
import {migrate, MigrateDBConfig} from "../"
import {PASSWORD, startPostgres, stopPostgres} from "./fixtures/docker-postgres"

const CONTAINER_NAME = "pg-migrations-test-migrate"

let port: number

process.on("uncaughtException", function (err) {
  console.log(err)
})

test.before(async () => {
  port = await startPostgres(CONTAINER_NAME)
})

test.after.always(() => {
  stopPostgres(CONTAINER_NAME)
})

test("concurrent migrations", async (t) => {
  const databaseName = "migration-test-concurrent"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  await migrate(dbConfig, "src/__tests__/fixtures/concurrent")

  // should deadlock if running concurrently
  await Promise.all([
    migrate(dbConfig, "src/__tests__/fixtures/concurrent-2"),
    migrate(dbConfig, "src/__tests__/fixtures/concurrent-2"),
  ])

  const exists = await doesTableExist(dbConfig, "concurrent")
  t.truthy(exists)
})

// https://github.com/ThomWright/postgres-migrations/issues/36
test("concurrent migrations - index concurrently", async (t) => {
  const databaseName = "migration-test-concurrent-no-tx"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  await migrate(dbConfig, "src/__tests__/fixtures/concurrent")

  // will deadlock if one process has the advisory lock and tries to index concurrently
  // while the other waits for the advisory lock
  await Promise.all([
    migrate(dbConfig, "src/__tests__/fixtures/concurrent-index-2", {
      logger: (msg) => console.log("A", msg),
    }),
    migrate(dbConfig, "src/__tests__/fixtures/concurrent-index-2", {
      logger: (msg) => console.log("B", msg),
    }),
  ])

  const exists = await doesTableExist(dbConfig, "concurrent")
  t.truthy(exists)
})

// can't test with unconnected client because `pg` just hangs on the first query...
test("with connected client", async (t) => {
  const databaseName = "migration-test-with-connected-client"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  // Create database first
  await migrate(dbConfig, "src/__tests__/fixtures/empty")

  // Now test with a connected client
  const client = new pg.Client({
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
  })
  try {
    await client.connect()

    await migrate({client}, "src/__tests__/fixtures/success-first")

    const exists = await doesTableExist(dbConfig, "success")
    t.truthy(exists)
  } finally {
    await client.end()
  }
})

test("with pool", async (t) => {
  const databaseName = "migration-test-with-pool"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  // Create database first
  await migrate(dbConfig, "src/__tests__/fixtures/empty")

  // Now test with a pool
  const pool = new pg.Pool({
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
  })
  try {
    await migrate({client: pool}, "src/__tests__/fixtures/success-first")

    const exists = await doesTableExist(dbConfig, "success")
    t.truthy(exists)
  } finally {
    await pool.end()
  }
})

test("with pool client", async (t) => {
  const databaseName = "migration-test-with-pool-client"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  // Create database first
  await migrate(dbConfig, "src/__tests__/fixtures/empty")

  // Now test with a pool client
  const pool = new pg.Pool({
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
  })
  try {
    const client = await pool.connect()
    try {
      await migrate({client}, "src/__tests__/fixtures/success-first")

      const exists = await doesTableExist(dbConfig, "success")
      t.truthy(exists)
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
})

test("successful first migration", async (t) => {
  const databaseName = "migration-test-success-first"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  await migrate(dbConfig, "src/__tests__/fixtures/success-first")
  const exists = await doesTableExist(dbConfig, "success")
  t.truthy(exists)
})

test("successful second migration", async (t) => {
  const databaseName = "migration-test-success-second"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  await migrate(dbConfig, "src/__tests__/fixtures/success-first")
  await migrate(dbConfig, "src/__tests__/fixtures/success-second")
  const exists = await doesTableExist(dbConfig, "more_success")
  t.truthy(exists)
})

test("successful first javascript migration", async (t) => {
  const databaseName = "migration-test-success-js-first"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  await migrate(dbConfig, "src/__tests__/fixtures/success-js-first")
  const exists = await doesTableExist(dbConfig, "success")
  t.truthy(exists)
})

test("successful second mixed js and sql migration", async (t) => {
  const databaseName = "migration-test-success-second-mixed-js-sql"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  await migrate(dbConfig, "src/__tests__/fixtures/success-js-first")
  await migrate(dbConfig, "src/__tests__/fixtures/success-second-mixed-js-sql")
  const exists = await doesTableExist(dbConfig, "more_success")
  t.truthy(exists)
})

test("successful complex js migration", async (t) => {
  const databaseName = "migration-test-success-complex-js"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  await migrate(dbConfig, "src/__tests__/fixtures/success-complex-js")
  const exists = await doesTableExist(dbConfig, "complex")
  t.truthy(exists)
})

test("bad arguments - incorrect user", async (t) => {
  const err = await t.throwsAsync(
    migrate(
      {
        database: "migration-test-args",
        user: "nobody",
        password: PASSWORD,
        host: "localhost",
        port,
      },
      "src/__tests__/fixtures/empty",
    ),
  )
  t.regex(err.message, /nobody/)
})

test("bad arguments - incorrect password", async (t) => {
  const err = await t.throwsAsync(
    migrate(
      {
        database: "migration-test-args",
        user: "postgres",
        password: "not_the_password",
        host: "localhost",
        port,
      },
      "src/__tests__/fixtures/empty",
    ),
  )
  t.regex(err.message, /password/)
})

test("bad arguments - incorrect host", async (t) => {
  const err = await t.throwsAsync(
    migrate(
      {
        database: "migration-test-args",
        user: "postgres",
        password: PASSWORD,
        host: "sillyhost",
        port,
      },
      "src/__tests__/fixtures/empty",
    ),
  )
  t.regex(err.message, /sillyhost/)
})

test("no database - ensureDatabaseExists = undefined", async (t) => {
  const err = await t.throwsAsync(
    migrate(
      {
        database: "migration-test-no-database",
        user: "postgres",
        password: PASSWORD,
        host: "localhost",
        port,
      },
      "src/__tests__/fixtures/empty",
    ),
  )
  t.regex(err.message, /database "migration-test-no-database" does not exist/)
})

test("no database - ensureDatabaseExists = true", async (t) => {
  const databaseName = "migration-test-no-db-ensure-exists"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,

    ensureDatabaseExists: true,
  }

  await migrate(dbConfig, "src/__tests__/fixtures/ensure-exists")
  const exists = await doesTableExist(dbConfig, "success")
  t.truthy(exists)
})

test("existing database - ensureDatabaseExists = true", async (t) => {
  const databaseName = "migration-test-existing-db-ensure-exists"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  // Run migrate twice - first creates db, second should handle existing db gracefully
  await migrate(dbConfig, "src/__tests__/fixtures/empty")
  await migrate(dbConfig, "src/__tests__/fixtures/ensure-exists")
  const exists = await doesTableExist(dbConfig, "success")
  t.truthy(exists)
})

test("no database - ensureDatabaseExists = true, bad default database", async (t) => {
  const databaseName = "migration-test-ensure-exists-nope"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,

    ensureDatabaseExists: true,
    defaultDatabase: "nopenopenope",
  }

  const err = await t.throwsAsync(
    migrate(dbConfig, "src/__tests__/fixtures/ensure-exists"),
  )
  t.regex(err.message, /database "nopenopenope" does not exist/)
})

test("no migrations dir", async (t) => {
  const databaseName = "migration-test-no-dir"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  const promise = migrate(dbConfig, "not/real/path")

  const err = await t.throwsAsync(promise)
  t.regex(err.message, /not\/real\/path/)
})

test("empty migrations dir", async (t) => {
  t.plan(0)
  const databaseName = "migration-test-empty-dir"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  await migrate(dbConfig, "src/__tests__/fixtures/empty")
})

test("non-consecutive ordering", async (t) => {
  const databaseName = "migration-test-non-consec"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  const promise = migrate(dbConfig, "src/__tests__/fixtures/non-consecutive")

  const err = await t.throwsAsync(promise)
  t.regex(err.message, /Found a non-consecutive migration ID/)
})

test("not starting from one", async (t) => {
  const databaseName = "migration-test-starting-id"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  const promise = migrate(dbConfig, "src/__tests__/fixtures/start-from-2")

  const err = await t.throwsAsync(promise)
  t.regex(err.message, /Found a non-consecutive migration ID/)
})

test("negative ID", async (t) => {
  const databaseName = "migration-test-negative"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  const promise = migrate(dbConfig, "src/__tests__/fixtures/negative")

  const err = await t.throwsAsync(promise)
  t.regex(err.message, /Found a non-consecutive migration ID/)
  t.regex(err.message, /-1_negative/, "Should name the problem file")
})

test("invalid file name", async (t) => {
  const databaseName = "migration-test-invalid-file-name"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  const promise = migrate(dbConfig, "src/__tests__/fixtures/invalid-file-name")

  const err = await t.throwsAsync(promise)
  t.regex(err.message, /Invalid file name/)
  t.regex(err.message, /migrate-this/, "Should name the problem file")
})

test("syntax error", async (t) => {
  const databaseName = "migration-test-syntax-error"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  const promise = migrate(dbConfig, "src/__tests__/fixtures/syntax-error")

  const err = await t.throwsAsync(promise)
  t.regex(err.message, /syntax error/)
})

test("bad javascript file - no generateSql method exported", async (t) => {
  const databaseName = "migration-test-javascript-file-errors"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  const promise = migrate(dbConfig, "src/__tests__/fixtures/js-no-generate-sql")

  const err = await t.throwsAsync(promise)
  t.regex(err.message, /export a 'generateSql' function/)
})

test("bad javascript file - generateSql not returning string literal", async (t) => {
  const databaseName = "migration-test-javascript-no-literal"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  const promise = migrate(
    dbConfig,
    "src/__tests__/fixtures/js-no-string-literal",
  )

  const err = await t.throwsAsync(promise)
  t.regex(err.message, /string literal/)
})

test("hash check failure", async (t) => {
  const databaseName = "migration-test-hash-check"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  const promise = migrate(
    dbConfig,
    "src/__tests__/fixtures/hash-check/first-run",
  ).then(() =>
    migrate(dbConfig, "src/__tests__/fixtures/hash-check/second-run"),
  )

  const err = await t.throwsAsync(promise)
  t.regex(err.message, /Hashes don't match/)
  t.regex(err.message, /1_migration/, "Should name the problem file")
})

test("rollback", async (t) => {
  const databaseName = "migration-test-rollback"
  const dbConfig: MigrateDBConfig = {
    database: databaseName,
    user: "postgres",
    password: PASSWORD,
    host: "localhost",
    port,
    ensureDatabaseExists: true,
  }

  const promise = migrate(dbConfig, "src/__tests__/fixtures/rollback")

  const err = await t.throwsAsync(promise)
  t.regex(err.message, /Rolled back/)
  t.regex(err.message, /trigger-rollback/)
  const exists = await doesTableExist(dbConfig, "should_get_rolled_back")
  t.false(
    exists,
    "The table created in the migration should not have been committed.",
  )
})

async function doesTableExist(dbConfig: pg.ClientConfig, tableName: string) {
  const client = new pg.Client(dbConfig)
  client.on("error", (err) => console.log("doesTableExist on error", err))
  await client.connect()
  const parts = tableName.split(".")
  const [schema, table] = (() => {
    if (parts.length > 1) {
      return [parts[0], parts[1]]
    } else {
      return ["public", tableName]
    }
  })()
  const result = await client.query(SQL`
        SELECT EXISTS (
          SELECT 1
          FROM   pg_catalog.pg_class c
          JOIN   pg_catalog.pg_namespace n
            ON     n.oid = c.relnamespace
          WHERE  c.relname = ${table}
            AND    c.relkind = 'r'
            AND    n.nspname = ${schema}
        );
      `)
  try {
    return client
      .end()
      .then(() => {
        return result.rows.length > 0 && result.rows[0].exists
      })
      .catch((error) => {
        console.log("Async error in 'doesTableExist", error)
        return result.rows.length > 0 && result.rows[0].exists
      })
  } catch (error_1) {
    console.log("Sync error in 'doesTableExist", error_1)
    return result.rows.length > 0 && result.rows[0].exists
  }
}
