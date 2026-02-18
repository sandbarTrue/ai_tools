import { NextResponse } from 'next/server';
import { defaultSubscriptions } from '@/data/subscriptions';

export async function GET() {
  return NextResponse.json(defaultSubscriptions);
}
