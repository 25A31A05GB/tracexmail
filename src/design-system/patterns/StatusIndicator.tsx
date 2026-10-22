import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Inbox, Radar } from 'lucide-react';
import { Badge, BadgeVariant } from '../primitives/Badge';

export type StatusType = 'verified' | 'anomaly' | 'alert' | 'destination' | 'intelligence';

export interface StatusIndicatorProps {
  status: StatusType;
  label: string;
  description?: string;
  pulsing?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const statusIconMap: Record<StatusType, React.ReactNode> = {
  verified: <CheckCircle2 className="w-3.5 h-3.5" />,
  anomaly: <AlertTriangle className="w-3.5 h-3.5" />,
  alert: <XCircle className="w-3.5 h-3.5" />,
  destination: <Inbox className="w-3.5 h-3.5" />,
  intelligence: <Radar className="w-3.5 h-3.5" />
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  description,
  pulsing = false,
  size = 'md',
  className = ''
}) => {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Badge
        variant={status as BadgeVariant}
        size={size}
        pulsing={pulsing}
        icon={statusIconMap[status]}
      >
        {label}
      </Badge>
      {description && (
        <span className="text-xs text-[var(--color-text-muted)] font-sans truncate">
          {description}
        </span>
      )}
    </div>
  );
};

StatusIndicator.displayName = 'StatusIndicator';
