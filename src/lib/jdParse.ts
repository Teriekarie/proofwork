/** Extract plain text from an uploaded job description (PDF, DOCX or TXT), in the browser. */
export const JD_ACCEPT = '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'
export const JD_MAX_BYTES = 10 * 1024 * 1024

export async function extractJdText(file: File): Promise<string> {
  if (file.size > JD_MAX_BYTES) throw new Error('That file is over 10 MB. Please upload a smaller file or paste the text.')
  const name = file.name.toLowerCase()

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist')
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      let line = ''
      const lines: string[] = []
      let lastY: number | null = null
      for (const item of content.items as { str: string; transform: number[]; hasEOL?: boolean }[]) {
        const y = item.transform[5]
        if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line.trim()); line = '' }
        line += item.str + (item.hasEOL ? '' : ' ')
        lastY = y
      }
      if (line.trim()) lines.push(line.trim())
      pages.push(lines.filter(Boolean).join('\n'))
    }
    const text = pages.join('\n\n').replace(/[ \t]+/g, ' ').trim()
    if (text.length < 40) throw new Error("This PDF looks like a scanned image, so there's no text to read. Please paste the text instead.")
    return text
  }

  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return value.replace(/\n{3,}/g, '\n\n').trim()
  }

  if (name.endsWith('.doc')) throw new Error('Old .doc files are not supported. Please save as .docx or PDF, or paste the text.')
  return (await file.text()).trim()
}
