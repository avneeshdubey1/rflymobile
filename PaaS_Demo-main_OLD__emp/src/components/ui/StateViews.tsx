import { CancelCircleIcon, Search01Icon } from '@hugeicons/core-free-icons';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="animate-fade-in min-h-[220px] border border-dashed border-border-subtle rounded-2xl bg-surface-tint flex flex-col items-center justify-center text-center gap-3 p-8">
      <Icon icon={Search01Icon} size={56} className="text-text-muted" />
      <h3 className="text-base font-semibold text-text-primary m-0">{title}</h3>
      <p className="text-sm text-text-secondary m-0 max-w-xs">{description}</p>
      {action}
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  description: string;
  onRetry: () => void;
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div className="animate-fade-in min-h-[220px] border border-dashed border-red-200 rounded-2xl bg-red-50/40 flex flex-col items-center justify-center text-center gap-3 p-8">
      <Icon icon={CancelCircleIcon} size={56} className="text-red-400" />
      <h3 className="text-base font-semibold text-text-primary m-0">{title}</h3>
      <p className="text-sm text-text-secondary m-0 max-w-xs">{description}</p>
      <button className="mt-2 h-10 px-5 rounded-lg bg-green-500 text-white font-semibold text-sm hover:bg-green-600 transition-colors cursor-pointer border-0" onClick={onRetry} type="button">
        Retry
      </button>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border-subtle bg-white p-5 flex flex-col gap-3">
      <div className="skeleton-pulse h-5 w-32 rounded-lg" />
      <div className="skeleton-pulse h-4 w-full rounded-lg" />
      <div className="skeleton-pulse h-4 w-4/5 rounded-lg" />
      <div className="skeleton-pulse h-10 w-28 rounded-lg" />
    </div>
  );
}
