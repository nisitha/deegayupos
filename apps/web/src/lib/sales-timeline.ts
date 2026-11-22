import type { SaleDto } from '@pixelcraft/types';

export interface TimelineDataPoint {
  date: string;       // ISO or YYYY-MM-DD
  label: string;      // X-axis label ("7 AM", "Nov 12", etc.)
  fullDate: string;   // Tooltip header ("Today • 7:00 AM - 8:00 AM", "Wed, Nov 18, 2026")
  sales: number;      // Gross revenue
  profit: number;     // Net profit
  count: number;      // Settled bills count
}

export function getColomboDateString(d: Date | string | number): string {
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj); // "YYYY-MM-DD"
}

export function getColomboHour(d: Date | string | number): number {
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(dateObj);
  const hourPart = parts.find((p) => p.type === 'hour')?.value || '0';
  return parseInt(hourPart, 10);
}

export function calculateSaleProfit(sale: SaleDto | any): number {
  if (Array.isArray(sale.items) && sale.items.length > 0) {
    let profit = 0;
    let hasCost = false;
    for (const item of sale.items) {
      const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
      const costPrice = Number(item.costPrice ?? item.cost_price ?? 0);
      const qty = Number(item.quantity ?? 1);
      if (costPrice > 0) {
        hasCost = true;
        profit += (unitPrice - costPrice) * qty;
      } else {
        // Fallback to standard 35% margin formula
        profit += unitPrice * qty * 0.35;
      }
    }
    if (hasCost || profit > 0) {
      return Math.round(profit * 100) / 100;
    }
  }
  // Bill-level fallback to 35% margin formula
  return Math.round(Number(sale.totalAmount ?? sale.total_amount ?? 0) * 0.35 * 100) / 100;
}

export interface SpecialStockTimelineItem {
  date?: string; // YYYY-MM-DD
  amount: number;
  profit: number;
  qty?: number;
  createdAt?: string;
}

export function buildColomboTimeline(
  sales: (SaleDto | any)[],
  period: 'today' | 'week' | 'month' | string,
  specialItems?: SpecialStockTimelineItem[]
): TimelineDataPoint[] {
  const now = new Date();
  const todayColomboStr = getColomboDateString(now);
  const parts = todayColomboStr.split('-').map((v) => parseInt(v, 10));
  const currYear = parts[0] ?? 2026;
  const currMonth = parts[1] ?? 11;
  const currDay = parts[2] ?? 18;

  // Exclude voided sales
  const validSales = (sales || []).filter((s) => {
    const status = String(s.status || '').toUpperCase();
    return status !== 'VOIDED';
  });

  if (period === 'today') {
    // Continuous hourly slots from 07:00 to 22:00 (7 AM to 10 PM) -> 16 slots
    const hourLabels: Record<number, string> = {
      7: '7 AM', 8: '8 AM', 9: '9 AM', 10: '10 AM', 11: '11 AM', 12: '12 PM',
      13: '1 PM', 14: '2 PM', 15: '3 PM', 16: '4 PM', 17: '5 PM', 18: '6 PM',
      19: '7 PM', 20: '8 PM', 21: '9 PM', 22: '10 PM',
    };

    const slots: TimelineDataPoint[] = [];
    const slotMap = new Map<number, TimelineDataPoint>();

    for (let h = 7; h <= 22; h++) {
      const hStr = String(h).padStart(2, '0');
      const label = hourLabels[h] || `${hStr}:00`;
      const nextH = h + 1;
      const nextLabel = hourLabels[nextH] || `${String(nextH).padStart(2, '0')}:00`;
      const point: TimelineDataPoint = {
        date: `${todayColomboStr}T${hStr}:00:00+05:30`,
        label,
        fullDate: `Today • ${label} - ${nextLabel}`,
        sales: 0,
        profit: 0,
        count: 0,
      };
      slots.push(point);
      slotMap.set(h, point);
    }

    for (const sale of validSales) {
      const createdAt = sale.createdAt || sale.created_at;
      if (!createdAt) continue;
      const saleDateStr = getColomboDateString(createdAt);
      if (saleDateStr !== todayColomboStr) continue;

      let h = getColomboHour(createdAt);
      if (h < 7) h = 7;
      if (h > 22) h = 22;

      const target = slotMap.get(h);
      if (target) {
        target.sales += Number(sale.totalAmount ?? sale.total_amount ?? 0);
        target.profit += calculateSaleProfit(sale);
        target.count += 1;
      }
    }

    // Include Special Stock items in hourly slots
    if (Array.isArray(specialItems)) {
      for (const item of specialItems) {
        const itemDateStr = item.date || (item.createdAt ? getColomboDateString(item.createdAt) : todayColomboStr);
        if (itemDateStr !== todayColomboStr) continue;

        let h = item.createdAt ? getColomboHour(item.createdAt) : 12;
        if (h < 7) h = 7;
        if (h > 22) h = 22;

        const target = slotMap.get(h);
        if (target) {
          target.sales += Number(item.amount || 0);
          target.profit += Number(item.profit || 0);
          target.count += Number(item.qty || 1);
        }
      }
    }

    slots.forEach((s) => {
      s.sales = Math.round(s.sales * 100) / 100;
      s.profit = Math.round(s.profit * 100) / 100;
    });

    return slots;
  }

  // 7 Days or 30 Days (Daily Buckets)
  const daysCount = period === 'month' || period === '30d' || period === '30days' || period === 'this_month' || period === 'last_month' ? 30 : 7;
  const slots: TimelineDataPoint[] = [];
  const slotMap = new Map<string, TimelineDataPoint>();

  const monthShortFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    month: 'short',
    day: 'numeric',
  });
  const fullDateFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(currYear, currMonth - 1, currDay - i, 12, 0, 0));
    const dateStr = getColomboDateString(d);
    const label = monthShortFmt.format(d);
    const fullDate = fullDateFmt.format(d);

    const point: TimelineDataPoint = {
      date: dateStr,
      label,
      fullDate,
      sales: 0,
      profit: 0,
      count: 0,
    };
    slots.push(point);
    slotMap.set(dateStr, point);
  }

  for (const sale of validSales) {
    const createdAt = sale.createdAt || sale.created_at;
    if (!createdAt) continue;
    const saleDateStr = getColomboDateString(createdAt);
    const target = slotMap.get(saleDateStr);
    if (target) {
      target.sales += Number(sale.totalAmount ?? sale.total_amount ?? 0);
      target.profit += calculateSaleProfit(sale);
      target.count += 1;
    }
  }

  // Include Special Stock items in daily buckets
  if (Array.isArray(specialItems)) {
    for (const item of specialItems) {
      const itemDateStr = item.date || (item.createdAt ? getColomboDateString(item.createdAt) : '');
      if (!itemDateStr) continue;
      const target = slotMap.get(itemDateStr);
      if (target) {
        target.sales += Number(item.amount || 0);
        target.profit += Number(item.profit || 0);
        target.count += Number(item.qty || 1);
      }
    }
  }

  slots.forEach((s) => {
    s.sales = Math.round(s.sales * 100) / 100;
    s.profit = Math.round(s.profit * 100) / 100;
  });

  return slots;
}
