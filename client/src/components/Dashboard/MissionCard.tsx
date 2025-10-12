import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Mission {
  id: string;
  name: string;
  field_name: string;
  status: string;
  mission_type: string;
  started_at?: string;
  duration_seconds?: number;
}

interface MissionCardProps {
  mission: Mission;
  onView: (id: string) => void;
}

export const MissionCard = ({ mission, onView }: MissionCardProps) => {
  const statusConfig = {
    running: { color: 'bg-success', label: 'Running', variant: 'default' as const },
    paused: { color: 'bg-warning', label: 'Paused', variant: 'secondary' as const },
    completed: { color: 'bg-muted', label: 'Completed', variant: 'outline' as const },
    aborted: { color: 'bg-danger', label: 'Aborted', variant: 'destructive' as const },
    planned: { color: 'bg-primary', label: 'Planned', variant: 'default' as const },
  };

  const config = statusConfig[mission.status as keyof typeof statusConfig] || statusConfig.planned;

  return (
    <Card className="border-border hover:border-primary/50 transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {mission.name}
              <div className={cn('w-2 h-2 rounded-full animate-pulse', config.color)} />
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span>{mission.field_name || 'Unknown Field'}</span>
            </div>
          </div>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Navigation className="w-4 h-4 text-muted-foreground" />
            <span className="capitalize">{mission.mission_type}</span>
          </div>
          {mission.duration_seconds && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>{Math.floor(mission.duration_seconds / 60)}m</span>
            </div>
          )}
        </div>
        <Button 
          onClick={() => onView(mission.id)} 
          variant="outline" 
          size="sm" 
          className="w-full"
        >
          View Details
        </Button>
      </CardContent>
    </Card>
  );
};
