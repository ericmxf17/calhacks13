export type SupplierPart = { supplier: string; part: string; cost: number }

/** Reads a supplier spreadsheet (.csv or .xlsx) with the columns supplier, part, cost. */
export async function parsePartsFile(file: File): Promise<SupplierPart[]> {
  if (file.size > 2 * 1024 * 1024)
    throw new Error('Please use a spreadsheet smaller than 2 MB.')
  let rows: unknown[][]
  if (/\.csv$/i.test(file.name)) {
    const { default: Papa } = await import('papaparse')
    const parsed = Papa.parse<string[]>(await file.text(), { skipEmptyLines: true })
    if (parsed.errors.length)
      throw new Error('This CSV could not be read. Check its formatting.')
    rows = parsed.data
  } else if (/\.xlsx$/i.test(file.name)) {
    const { readSheet: read } = await import('read-excel-file/browser')
    rows = await read(file)
  } else throw new Error('Choose a .csv or .xlsx spreadsheet.')
  const headers = (rows[0] ?? []).map((v) => String(v).trim().toLowerCase())
  const columns = ['supplier', 'part', 'cost'].map((name) => headers.indexOf(name))
  if (columns.some((i) => i < 0))
    throw new Error('Your spreadsheet needs these column headers: supplier, part, cost.')
  const parts = rows
    .slice(1)
    .filter((row) => row.some((v) => v !== null && v !== ''))
    .map((row, i) => {
      const supplier = String(row[columns[0]] ?? '').trim()
      const part = String(row[columns[1]] ?? '').trim()
      const rawCost = row[columns[2]]
      const cost = Number(rawCost)
      if (
        !supplier ||
        !part ||
        supplier.length > 200 ||
        part.length > 200 ||
        rawCost === '' ||
        rawCost == null ||
        !Number.isFinite(cost) ||
        cost < 0
      )
        throw new Error(`Check supplier, part, and cost on row ${i + 2}.`)
      return { supplier, part, cost }
    })
  if (!parts.length || parts.length > 1000)
    throw new Error('Include between 1 and 1,000 supplier parts.')
  return parts
}
