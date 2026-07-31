import * as XLSX from 'xlsx'

export async function exportToExcel(filename, sheetName, headers, rows, title) {
  const aoa = title ? [[title], [], headers, ...rows] : [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = headers.map(() => ({ wch: 16 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, filename)
}
