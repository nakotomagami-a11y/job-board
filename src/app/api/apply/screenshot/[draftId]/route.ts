import fs from 'fs/promises';
import path from 'path';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'data', 'user', 'apply-screenshots');

export async function GET(_req: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  // Only allow safe filename characters — no path traversal.
  if (!/^[a-zA-Z0-9-]+$/.test(draftId)) {
    return new Response('Not found', { status: 404 });
  }
  const filePath = path.join(SCREENSHOTS_DIR, `${draftId}.png`);
  try {
    const buf = await fs.readFile(filePath);
    return new Response(buf, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
