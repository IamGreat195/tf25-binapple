import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  status?: 'success' | 'warning' | 'danger' | 'default';
}

export const StatCard = ({ title, value, icon: Icon, trend, status = 'default' }: StatCardProps) => {
  const statusColors = {
    success: 'border-success/30 bg-success/5',
    warning: 'border-warning/30 bg-warning/5',
    danger: 'border-danger/30 bg-danger/5',
    default: 'border-border bg-card',
  };

  return (
    <Card className={cn('transition-all hover:shadow-lg', statusColors[status])}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {trend && (
              <p className="text-xs text-muted-foreground">
                <span className={cn(
                  'font-semibold',
                  trend.value > 0 ? 'text-success' : trend.value < 0 ? 'text-danger' : ''
                )}>
                  {trend.value > 0 ? '+' : ''}{trend.value}%
                </span>{' '}
                {trend.label}
              </p>
            )}
          </div>
          <div className={cn(
            'p-3 rounded-full',
            status === 'success' ? 'bg-success/10 text-success' :
            status === 'warning' ? 'bg-warning/10 text-warning' :
            status === 'danger' ? 'bg-danger/10 text-danger' :
            'bg-primary/10 text-primary'
          )}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
