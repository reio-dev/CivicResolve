import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatPercentage(num: number): string {
  return `${num.toFixed(1)}%`;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    reported: 'bg-yellow-100 text-yellow-800',
    verified: 'bg-blue-100 text-blue-800',
    validated: 'bg-blue-100 text-blue-800',
    assigned: 'bg-purple-100 text-purple-800',
    accepted: 'bg-indigo-100 text-indigo-800',
    in_progress: 'bg-orange-100 text-orange-800',
    inProgress: 'bg-orange-100 text-orange-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
    rejected: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };
  return colors[priority] || 'bg-gray-100 text-gray-800';
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    roads: 'bg-amber-100 text-amber-800',
    water: 'bg-blue-100 text-blue-800',
    waste: 'bg-green-100 text-green-800',
    electricity: 'bg-yellow-100 text-yellow-800',
    drainage: 'bg-cyan-100 text-cyan-800',
    parks: 'bg-emerald-100 text-emerald-800',
    other: 'bg-gray-100 text-gray-800',
  };
  return colors[category] || 'bg-gray-100 text-gray-800';
}
