import { NextResponse } from 'next/server';
import { CronJob } from '@/types';

interface OpenClawSchedule {
  kind: string;
  expr?: string;
  tz?: string;
}

interface OpenClawState {
  lastRunAtMs?: number;
  lastStatus?: string;
  lastDurationMs?: number;
  consecutiveErrors?: number;
  nextRunAtMs?: number;
}

interface OpenClawPayload {
  kind?: string;
  message?: string;
}

interface OpenClawJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: OpenClawSchedule;
  state: OpenClawState;
  payload?: OpenClawPayload;
}

interface OpenClawResponse {
  jobs: OpenClawJob[];
}

function mapStatus(status: string | undefined): 'success' | 'failed' | 'timeout' | null {
  if (!status) return null;
  if (status === 'ok') return 'success';
  if (status === 'error') return 'failed';
  return status as 'success' | 'failed' | 'timeout';
}

function mapSchedule(schedule: OpenClawSchedule): string {
  if (schedule.expr) return schedule.expr;
  if (schedule.kind) return `every ${schedule.kind}`;
  return 'unknown';
}

export async function GET() {
  try {
    const response = await fetch('http://localhost:4152/api/cron?includeDisabled=true', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`OpenClaw API returned ${response.status}`);
    }

    const data: OpenClawResponse = await response.json();

    const crons: CronJob[] = data.jobs.map((job) => ({
      id: job.id,
      name: job.name,
      schedule: mapSchedule(job.schedule),
      enabled: job.enabled,
      lastRun: job.state.lastRunAtMs ? new Date(job.state.lastRunAtMs).toISOString() : null,
      lastStatus: mapStatus(job.state.lastStatus),
      lastDuration: job.state.lastDurationMs ? Math.round(job.state.lastDurationMs / 1000) : null,
      consecutiveFailures: job.state.consecutiveErrors || 0,
      nextRun: job.state.nextRunAtMs ? new Date(job.state.nextRunAtMs).toISOString() : '-',
    }));

    return NextResponse.json(crons);
  } catch (error) {
    console.error('Failed to fetch from OpenClaw API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cron data' },
      { status: 500 }
    );
  }
}
