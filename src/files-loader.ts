import * as fs from "fs"
import * as path from "path"
import {promisify} from "util"
import {fileURLToPath} from "url"
import {loadMigrationFile} from "./migration-file"
import {Logger, Migration} from "./types"
import {validateMigrationOrdering} from "./validation"

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const readDir = promisify(fs.readdir)

const isValidFile = (fileName: string) => /\.(sql|js)$/gi.test(fileName)

/**
 * Load the migration files and assert they are reasonably valid.
 *
 * 'Reasonably valid' in this case means obeying the file name and
 * consecutive ordering rules.
 *
 * No assertions are made about the validity of the SQL.
 */
export const loadMigrationFiles = async (
  directory: string,
  // tslint:disable-next-line no-empty
  log: Logger = () => {},
  schemaName: string = "public",
): Promise<Array<Migration>> => {
  log(`Loading migrations from: ${directory}`)

  const fileNames = await readDir(directory)
  log(`Found migration files: ${fileNames}`)

  if (fileNames == null) {
    return []
  }

  const migrationFiles = [
    path.join(currentDir, "migrations/0_create-migrations-table.sql"),
    ...fileNames.map((fileName) => path.resolve(directory, fileName)),
  ].filter(isValidFile)

  const unorderedMigrations = await Promise.all(
    migrationFiles.map(loadMigrationFile),
  )

  // Arrange in ID order
  const orderedMigrations = unorderedMigrations.sort((a, b) => a.id - b.id)

  validateMigrationOrdering(orderedMigrations)

  orderedMigrations[0].sql = orderedMigrations[0].sql.replace(
    "CREATE TABLE IF NOT EXISTS migrations",
    `CREATE SCHEMA IF NOT EXISTS ${schemaName}; CREATE TABLE IF NOT EXISTS ${schemaName}.migrations`,
  )

  return orderedMigrations
}
