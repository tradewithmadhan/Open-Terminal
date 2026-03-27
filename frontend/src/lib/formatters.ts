export function formatIndianNumber(num: number | undefined | null, decimals = 2): string {
  if (num === undefined || num === null || isNaN(num)) return '₹0.00';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  return `${sign}₹${abs.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatPrice(price: number | string | undefined | null): string {
  const val = typeof price === 'string' ? parseFloat(price) : price;
  if (val === undefined || val === null || isNaN(val)) return '0.00';
  return val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return '0.00%';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function formatQty(qty: number | string | undefined | null): string {
  const n = typeof qty === 'string' ? parseInt(qty, 10) : qty;
  if (n === undefined || n === null || isNaN(n)) return '0';
  return n.toLocaleString('en-IN');
}

export function formatVolume(vol: number | string | undefined | null): string {
  const n = typeof vol === 'string' ? parseFloat(vol) : vol;
  if (n === undefined || n === null || isNaN(n)) return '0';
  if (n >= 1e7) return `${(n / 1e7).toFixed(1)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)} L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
  return n.toLocaleString('en-IN');
}

export function formatTime(date: Date | string | number | undefined | null = new Date()): string {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Kolkata',
  }) + ' IST';
}

export function formatDate(date: Date | string | number | undefined | null = new Date()): string {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function convertExpiry(expiry: string | undefined | null): string {
  if (!expiry) return '—';
  // "10-JUL-25" → "10JUL25"
  return expiry.replace(/-/g, '').toUpperCase();
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
