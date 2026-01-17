import * as path from "path"
import {pathToFileURL} from "url"

export const loadSqlFromJs = async (filePath: string): Promise<string> => {
  const fileUrl = pathToFileURL(filePath).href
  const migrationModule = await import(fileUrl)
  if (!migrationModule.generateSql) {
    throw new Error(`Invalid javascript migration file: '${path.basename(
      filePath,
    )}'.
It must to export a 'generateSql' function.`)
  }
  const generatedValue = migrationModule.generateSql()
  if (typeof generatedValue !== "string") {
    throw new Error(`Invalid javascript migration file: '${path.basename(
      filePath,
    )}'.
'generateSql' function must return a string literal.`)
  }

  return generatedValue
}
