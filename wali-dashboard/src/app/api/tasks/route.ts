import { NextResponse } from 'next/server';
import { defaultTasks } from '@/data/tasks';

export async function GET() {
  return NextResponse.json(defaultTasks);
}
