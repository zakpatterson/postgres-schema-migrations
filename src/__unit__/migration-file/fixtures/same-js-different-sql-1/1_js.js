import getNumber from "../inc.js"

export const generateSql = () => {
  return "SELECT * FROM something; " + getNumber()
}
