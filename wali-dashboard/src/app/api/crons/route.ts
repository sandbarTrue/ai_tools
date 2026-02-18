import { NextResponse } from 'next/server';
import { defaultCrons } from '@/data/crons';

export async function GET() {
  return NextResponse.json(defaultCrons);
}
