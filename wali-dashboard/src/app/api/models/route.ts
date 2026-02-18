import { NextResponse } from 'next/server';
import { defaultModels } from '@/data/models';

export async function GET() {
  return NextResponse.json(defaultModels);
}
