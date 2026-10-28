import type { Clock } from '../../src/application/ports/Clock';

export class FakeClock implements Clock {
  private current: Date;

  constructor(iso = '2026-10-28T12:00:00Z') {
    this.current = new Date(iso);
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
