// Simple festival scheduler: supports 'Diwali' and 'Akshaya Tritiya' via lookup table per year
// Coupons may include a `schedule` object: { type: 'festival', name: 'Diwali', year?: 2026, fromOffsetDays?: -2, toOffsetDays?: 2 }

const festivalDates: Record<string, Record<number, string>> = {
  Diwali: {
    2023: '2023-11-12',
    2024: '2024-11-01',
    2025: '2025-10-21',
    2026: '2026-11-08',
    2027: '2027-10-28'
  },
  AkshayaTritiya: {
    2023: '2023-05-22',
    2024: '2024-05-11',
    2025: '2025-05-01',
    2026: '2026-05-20',
    2027: '2027-05-09'
  }
};

const parseDate = (s: string) => {
  const d = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

export const computeFestivalPeriod = (name: string, year?: number, fromOffset = 0, toOffset = 0) => {
  const key = name.replace(/\s+/g, '').replace(/[^a-zA-Z]/g, '');
  const lookupName = key === 'AkshayaTritiya' ? 'AkshayaTritiya' : (key.charAt(0).toUpperCase() + key.slice(1));
  const y = year || new Date().getFullYear();
  const dateStr = festivalDates[lookupName] && festivalDates[lookupName][y];
  if (!dateStr) return null;
  const base = parseDate(dateStr);
  if (!base) return null;
  const from = new Date(base.getTime() + fromOffset * 24 * 3600 * 1000);
  const to = new Date(base.getTime() + toOffset * 24 * 3600 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
};

export const applyScheduleToCoupon = (coupon: any) => {
  if (!coupon || !coupon.schedule) return coupon;
  const s = coupon.schedule;
  if (s.type === 'festival') {
    const period = computeFestivalPeriod(s.name, s.year, Number(s.fromOffsetDays || 0), Number(s.toOffsetDays || 0));
    if (period) {
      coupon.validFrom = period.from;
      coupon.validTo = period.to;
    }
  } else if (s.type === 'fixed') {
    // fixed schedule: {type:'fixed', from:'YYYY-MM-DD', to:'YYYY-MM-DD'}
    if (s.from && s.to) {
      coupon.validFrom = new Date(s.from).toISOString();
      coupon.validTo = new Date(s.to).toISOString();
    }
  }
  return coupon;
};

export default { computeFestivalPeriod, applyScheduleToCoupon };
