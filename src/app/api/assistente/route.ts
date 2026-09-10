import { NextRequest, NextResponse } from 'next/server';
import { runAgentTurn, type ChatMessage, type PendingAction } from '@/lib/assistantCore';

// Endpoint per la barra assistente della dashboard Motore Rafilu: stato (cronologia,
// proposta in sospeso) tenuto dal browser e rimandato ad ogni richiesta, non sul server.

export async function POST(req: NextRequest) {
  try {
    const expectedKey = process.env.PLANCIA_ACCESS_KEY;
    if (expectedKey && req.headers.get('x-plancia-key') !== expectedKey) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const body = await req.json() as { message: string; history?: ChatMessage[]; pendingAction?: PendingAction | null };
    const message = (body.message || '').trim();
    if (!message) return NextResponse.json({ ok: false, error: 'Messaggio vuoto' }, { status: 400 });

    const result = await runAgentTurn(req.nextUrl.origin, message, body.history || [], body.pendingAction || null);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
