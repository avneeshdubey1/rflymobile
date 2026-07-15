import { HugeiconsIcon } from '@hugeicons/react';
import type { IconSvgElement } from '@hugeicons/react';

interface IconProps {
  icon: IconSvgElement;
  size?: number;
  className?: string;
}

export function Icon({ icon, size = 20, className }: IconProps) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.7} className={className} color="currentColor" />;
}

