// Reads the text of a Word file in the browser. Loaded on demand because mammoth is large.

export function base64ToBytes(base64OrDataUrl: string): Uint8Array {
  const binary = atob(base64OrDataUrl.replace(/^data:[^;]*;base64,/, '').trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function extractWordText(arrayBuffer: ArrayBuffer): Promise<string> {
  const module = await import('mammoth');
  const mammoth = module.default ?? module;
  const parsed = await mammoth.extractRawText({ arrayBuffer });
  return (parsed.value || '').trim();
}

export function extractWordTextFromBase64(base64OrDataUrl: string): Promise<string> {
  const bytes = base64ToBytes(base64OrDataUrl);
  return extractWordText(bytes.buffer as ArrayBuffer);
}
