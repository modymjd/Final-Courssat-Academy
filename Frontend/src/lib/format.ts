import { formatDistanceToNow, format as dateFnsFormat } from "date-fns";
import { arSA } from "date-fns/locale/ar-SA";

export function formatCurrency(n: number, currency = "EGP") {
  if (currency === "EGP") {
    return `${new Intl.NumberFormat("ar-EG").format(n)} ج.م`;
  }
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("ar-EG").format(n);
}

export function formatRelative(iso: string) {
  return formatDistanceToNow(new Date(iso), { locale: arSA, addSuffix: true });
}

export function formatDate(iso: string, pattern = "PPP") {
  return dateFnsFormat(new Date(iso), pattern, { locale: arSA });
}
