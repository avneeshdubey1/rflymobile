import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-text-primary tracking-tight">{title}</h2>
        <p className="text-sm text-text-secondary mt-1">{description}</p>
      </div>
      {action}
    </div>
  );
}
