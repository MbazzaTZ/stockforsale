import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
}: MetricCardProps) {
  const variantStyles = {
    default: {
      card: 'glass',
      icon: 'bg-primary/10 text-primary',
      glow: '',
    },
    primary: {
      card: 'glass metric-glow',
      icon: 'gradient-primary text-primary-foreground',
      glow: 'metric-glow',
    },
    success: {
      card: 'glass success-glow',
      icon: 'gradient-success text-success-foreground',
      glow: 'success-glow',
    },
    warning: {
      card: 'glass warning-glow',
      icon: 'gradient-warning text-warning-foreground',
      glow: 'warning-glow',
    },
    danger: {
      card: 'glass danger-glow',
      icon: 'gradient-danger text-destructive-foreground',
      glow: 'danger-glow',
    },
    info: {
      card: 'glass border-info/20',
      icon: 'bg-info/10 text-info',
      glow: '',
    },
  };

  const styles = variantStyles[variant] || variantStyles.default;

  return (
    <div className={cn('rounded-xl p-5 animate-fade-in', styles.card)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 text-xs">
              <span
                className={cn(
                  'font-medium',
                  trend.isPositive ? 'text-success' : 'text-destructive'
                )}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          )}
        </div>
        <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center', styles.icon)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
