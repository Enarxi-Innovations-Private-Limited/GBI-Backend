import { TelemetryQueryService } from './telemetry-query.service';

describe('TelemetryQueryService - autoInterval (Nearest Rounding & 100 points target)', () => {
  it('should return 1 minute for small ranges <= 15 minutes', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-01T00:15:00Z'); // 15 mins
    const interval = TelemetryQueryService.autoInterval(start, end);
    expect(interval).toBe(1);
  });

  it('should return 1 minute for a 1-hour range (rounds 0.6 mins up to 1)', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-01T01:00:00Z'); // 60 mins
    const interval = TelemetryQueryService.autoInterval(start, end);
    expect(interval).toBe(1);
  });

  it('should return 5 minutes for a 12-hour range (720 mins / 100 = 7.2 mins, rounds to 5)', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-01T12:00:00Z'); // 12 hours
    const interval = TelemetryQueryService.autoInterval(start, end);
    expect(interval).toBe(5);
  });

  it('should return 15 minutes for a 24-hour range (1440 mins / 100 = 14.4 mins, rounds to 15)', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-02T00:00:00Z'); // 24 hours
    const interval = TelemetryQueryService.autoInterval(start, end);
    expect(interval).toBe(15);
  });

  it('should return 120 minutes (2 hours) for a 10-day range (rounds 144 mins to 120)', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-11T00:00:00Z'); // 10 days (14,400 mins)
    const interval = TelemetryQueryService.autoInterval(start, end);
    expect(interval).toBe(120); // 2 hours
  });

  it('should return 4320 minutes (3 days) for a 1-year range (rounds 5256 mins to 4320)', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
    const interval = TelemetryQueryService.autoInterval(start, end);
    expect(interval).toBe(4320); // 3 days
  });
});
