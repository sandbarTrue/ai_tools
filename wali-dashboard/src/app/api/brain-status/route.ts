import { NextResponse } from 'next/server';
import { defaultBrainStatus } from '@/data/models';

export async function GET() {
  return NextResponse.json(defaultBrainStatus);
}
