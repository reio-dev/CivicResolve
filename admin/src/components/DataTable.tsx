import { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyMessage?: string;
  isLoading?: boolean;
}

function DataTable<T extends object>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  sortKey,
  sortDirection,
  onSort,
  emptyMessage = 'No data available',
  isLoading = false,
}: DataTableProps<T>) {
  const renderSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null;

    const isActive = sortKey === column.key;
    return (
      <span className="ml-1 inline-flex flex-col">
        <ChevronUp
          className={cn(
            'h-3 w-3 -mb-1',
            isActive && sortDirection === 'asc'
              ? 'text-blue-600'
              : 'text-gray-300 dark:text-gray-600'
          )}
        />
        <ChevronDown
          className={cn(
            'h-3 w-3',
            isActive && sortDirection === 'desc'
              ? 'text-blue-600'
              : 'text-gray-300 dark:text-gray-600'
          )}
        />
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider',
                  column.sortable && 'cursor-pointer hover:text-gray-900 dark:hover:text-white',
                  column.className
                )}
                onClick={() => column.sortable && onSort?.(column.key)}
              >
                <span className="flex items-center">
                  {column.header}
                  {renderSortIcon(column)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {isLoading ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  Loading...
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={cn(
                  'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn('px-4 py-3 text-sm text-gray-700 dark:text-gray-300', column.className)}
                  >
                    {column.render
                      ? column.render(item)
                      : String((item as Record<string, unknown>)[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
