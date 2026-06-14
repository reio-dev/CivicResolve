import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '../lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info';
  size?: 'sm' | 'md' | 'lg';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      primary: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
      secondary: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      success: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
      danger: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
      info: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-xs',
      lg: 'px-3 py-1 text-sm',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium rounded-full',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export function getStatusBadgeVariant(
  status: string
): BadgeProps['variant'] {
  const statusMap: Record<string, BadgeProps['variant']> = {
    reported: 'warning',
    verified: 'info',
    validated: 'info',
    assigned: 'secondary',
    accepted: 'primary',
    in_progress: 'primary',
    inProgress: 'primary',
    resolved: 'success',
    closed: 'default',
    rejected: 'danger',
  };
  return statusMap[status] || 'default';
}

export function getPriorityBadgeVariant(
  priority: string
): BadgeProps['variant'] {
  const priorityMap: Record<string, BadgeProps['variant']> = {
    low: 'default',
    medium: 'warning',
    high: 'danger',
    critical: 'danger',
  };
  return priorityMap[priority] || 'default';
}

export default Badge;
