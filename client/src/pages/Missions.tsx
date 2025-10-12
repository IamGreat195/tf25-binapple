import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Play, Pause, StopCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Mission {
  id: string;
  name: string;
  mission_type: string;
  status: string;
  created_at: string;
  field_id: string;
  fields: { name: string };
}

const Missions = () => {
  const navigate = useNavigate();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadMissions();
  }, []);

  const loadMissions = async () => {
    try {
      const { data, error } = await supabase
        .from('missions')
        .select('*, fields(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMissions(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading missions',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      planned: 'outline',
      running: 'default',
      paused: 'secondary',
      completed: 'secondary',
      aborted: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const getMissionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      spraying: 'text-blue-500',
      scouting: 'text-green-500',
      mapping: 'text-purple-500',
      custom: 'text-orange-500',
    };
    return colors[type] || 'text-gray-500';
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Loading missions...</p>
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-xl font-bold">Mission Management</h1>
            </div>
            <Button onClick={() => navigate('/missions/create')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Mission
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {missions.length === 0 ? (
          <Card className="p-8 text-center">
            <Play className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No missions yet</h3>
            <p className="text-muted-foreground mb-4">Create your first mission to get started</p>
            <Button onClick={() => navigate('/missions/create')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Mission
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {missions.map((mission) => (
              <Card
                key={mission.id}
                className="p-4 hover:border-primary transition-colors cursor-pointer"
                onClick={() => navigate(`/missions/${mission.id}`)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{mission.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {mission.fields?.name || 'Unknown Field'}
                    </p>
                  </div>
                  {getStatusBadge(mission.status)}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <span className={`font-medium capitalize ${getMissionTypeColor(mission.mission_type)}`}>
                      {mission.mission_type}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium">
                      {new Date(mission.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Missions;
