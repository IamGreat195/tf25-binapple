import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/Dashboard/StatCard';
import { MissionCard } from '@/components/Dashboard/MissionCard';
import { Activity, Map, Plane, AlertTriangle, LogOut, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MissionWithField {
  id: string;
  name: string;
  status: string;
  mission_type: string;
  started_at?: string;
  duration_seconds?: number;
  field: {
    name: string;
  } | null;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [missions, setMissions] = useState<MissionWithField[]>([]);
  const [stats, setStats] = useState({
    totalMissions: 0,
    activeMissions: 0,
    totalFields: 0,
    alerts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();

    // Set up realtime subscription for missions
    const channel = supabase
      .channel('dashboard-missions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'missions',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadDashboardData = async () => {
    try {
      const [missionsRes, fieldsRes, alertsRes] = await Promise.all([
        supabase
          .from('missions')
          .select('*, field:fields(name)')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('fields').select('id', { count: 'exact', head: true }),
        supabase
          .from('alerts')
          .select('id', { count: 'exact', head: true })
          .eq('resolved', false),
      ]);

      if (missionsRes.data) {
        const formattedMissions = missionsRes.data.map(m => ({
          ...m,
          field_name: m.field?.name || 'Unknown',
        }));
        setMissions(formattedMissions as any);

        setStats({
          totalMissions: missionsRes.data.length,
          activeMissions: missionsRes.data.filter(m => m.status === 'running').length,
          totalFields: fieldsRes.count || 0,
          alerts: alertsRes.count || 0,
        });
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Plane className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">AgriDrone GCS</h1>
                <p className="text-sm text-muted-foreground">Ground Control Station</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => navigate('/fields')}>
                <Map className="w-4 h-4 mr-2" />
                Fields
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/missions')}>
                <Plane className="w-4 h-4 mr-2" />
                Missions
              </Button>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Missions"
                value={stats.totalMissions}
                icon={Activity}
                trend={{ value: 12, label: 'vs last month' }}
              />
              <StatCard
                title="Active Missions"
                value={stats.activeMissions}
                icon={Plane}
                status={stats.activeMissions > 0 ? 'success' : 'default'}
              />
              <StatCard
                title="Total Fields"
                value={stats.totalFields}
                icon={Map}
              />
              <StatCard
                title="Active Alerts"
                value={stats.alerts}
                icon={AlertTriangle}
                status={stats.alerts > 0 ? 'warning' : 'success'}
              />
            </div>

            {/* Missions Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Recent Missions</h2>
                <Button onClick={() => navigate('/missions/create')}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Mission
                </Button>
              </div>

              {missions.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border rounded-lg">
                  <Plane className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No missions yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first mission to get started</p>
                  <Button onClick={() => navigate('/missions/create')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Mission
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {missions.map(mission => (
                    <MissionCard
                      key={mission.id}
                      mission={mission as any}
                      onView={(id) => navigate(`/missions/${id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
