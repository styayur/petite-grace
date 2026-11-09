function encodeAscii(text: string): Uint8Array {
  const encoded = new TextEncoder().encode(text);
  return encoded;
}

export function createMinimalPdf(pageCount = 2): ArrayBuffer {
  const objects: string[] = [];
  const pageObjectIds = Array.from({ length: pageCount }, (_, index) => 4 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  for (let index = 0; index < pageCount; index += 1) {
    const pageId = pageObjectIds[index]!;
    const contentId = pageId + 1;
    const content = `BT /F1 24 Tf 72 720 Td (Petite Grace PDF page ${index + 1}) Tj ET`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  }

  let output = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = encodeAscii(output).length;
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = encodeAscii(output).length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    output += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return encodeAscii(output).buffer as ArrayBuffer;
}
