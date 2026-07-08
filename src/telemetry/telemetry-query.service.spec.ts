import { TelemetryQueryService } from './telemetry-query.service';

describe('TelemetryQueryService - autoInterval (Nearest Rounding & 50 points target)', () => {
  it('should return 1 minute for small ranges <= 15 minutes', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-01T00:15:00Z'); // 15 mins
    const interval = TelemetryQueryService.autoInterval(start, end);
    expect(interval).toBe(1);
  });

  it('should return 1 minute for a 1-hour range (rounds 1.2 mins down to 1)', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-01T01:00:00Z'); // 60 mins
    const interval = TelemetryQueryService.autoInterval(start, end);
    expect(interval).toBe(1);
  });

  it('should return 15 minutes for a 12-hour range (720 mins / 50 = 14.4 mins, rounds to 15)', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-01T12:00:00Z'); // 12 hours
    const interval = TelemetryQueryService.autoInterval(start, end);
    expect(interval).toBe(15);
  });

  it('should return 30 minutes for a 24-hour range (1440 mins / 50 = 28.8 mins, rounds to 30)', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-02T00:00:00Z'); // 24 hours
    const interval = TelemetryQueryService.autoInterval(start, end);
    expect(interval).toBe(30);
  });

  it('should return 240 minutes (4 hours) for a 10-day range (rounds 288 mins down to 240 instead of strict snap to 360)', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-11T00:00:00Z'); // 10 days (14,400 mins)
    const interval = TelemetryQueryService.autoInterval(start, end);
    expect(interval).toBe(240); // 4 hours
  });

  it('should return 10080 minutes (1 week) for a 1-year range (rounds 10512 mins to 10080)', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
    const interval = TelemetryQueryService.autoInterval(start, end);
    expect(interval).toBe(10080); // 1 week
  });
});
