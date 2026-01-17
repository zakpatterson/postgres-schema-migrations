import createSuccess from "./schema/create_success.js"
import createDynamicTable from "./schema/create_dynamic_table.js"

export const generateSql = () => `
${createSuccess}
${createDynamicTable("complex")}
`
