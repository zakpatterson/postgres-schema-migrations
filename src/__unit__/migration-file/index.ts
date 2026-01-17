import test from "ava"
import {fileURLToPath} from "url"
import {dirname} from "path"
import {loadMigrationFile} from "../../migration-file"

const testDir = dirname(fileURLToPath(import.meta.url))

test("Hashes of JS files should be the same when the SQL is the same", async (t) => {
  const [js1, js2] = await Promise.all([
    loadMigrationFile(testDir + "/fixtures/different-js-same-sql-1/1_js.js"),
    loadMigrationFile(testDir + "/fixtures/different-js-same-sql-2/1_js.js"),
  ])

  t.is(js1.hash, js2.hash)
})

test("Hashes of JS files should be different when the SQL is different", async (t) => {
  const [js1, js2] = await Promise.all([
    loadMigrationFile(testDir + "/fixtures/same-js-different-sql-1/1_js.js"),
    loadMigrationFile(testDir + "/fixtures/same-js-different-sql-2/1_js.js"),
  ])

  t.not(js1.hash, js2.hash)
})
