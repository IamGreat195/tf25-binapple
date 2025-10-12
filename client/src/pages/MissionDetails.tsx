import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import MissionDetailsMap from '@/components/Missions/MissionDetailsMap';
import MissionSidebar from '@/components/Missions/MissionSidebar';
import { DroneType, useSocket } from '@/contexts/SocketContext';

type Mission = Database['public']['Tables']['missions']['Row'];
type Field = Database['public']['Tables']['fields']['Row'];
type Telemetry = Database['public']['Tables']['telemetry']['Row'];
type Alert = Database['public']['Tables']['alerts']['Row'];

type MissionWithField = Mission & {
  fields: Field | null;
};

export default function MissionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mission, setMission] = useState<MissionWithField>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState<'osm' | 'satellite' | 'terrain' | 'dark'>('satellite');
  const { toast } = useToast();
  const [selectedDrone, setSelectedDrone] = useState<DroneType | null>(null);
  const { socket, availableDrones, latestTelemetry } = useSocket();

  useEffect(() => {
    if (id) {
      loadMissionData();
      setupRealtimeSubscription();
    }
  }, [id]);

  const loadMissionData = async () => {
    try {
      const { data: missionData, error: missionError } = await supabase
        .from('missions')
        .select('*, fields(*)')
        .eq('id', id)
        .single();

      if (missionError) throw missionError;
      setMission(missionData);

      const { data: alertsData } = await supabase
        .from('alerts')
        .select('*')
        .eq('mission_id', id)
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      setAlerts(alertsData || []);
    } catch (error: any) {
      toast({
        title: 'Error loading mission',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('mission-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'telemetry',
          filter: `mission_id=eq.${id}`,
        },
        () => {
          loadMissionData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSelectDrone = (droneId: string) => {
    if (droneId === "nil") {
      if (selectedDrone && socket) {
        socket.emit('change-drone-status', {
          droneId: selectedDrone.droneId,
          mission: mission,
          status: 'idle'
        })
      } else {
        setSelectedDrone(null)
      }
    } else {
      const drone = availableDrones.find((d) => d.droneId === droneId)

      if (!drone || !socket) {
        setSelectedDrone(null)
        return
      }

      socket.emit('change-drone-status', {
        droneId,
        mission,
        status: 'busy',
      })
    }
  }

  useEffect(() => {
    if (!mission) return
    if (!availableDrones.length) return

    const updated = availableDrones.find((d) => d.missionId === mission.id)
    setSelectedDrone(updated || null)
  }, [mission, availableDrones])

  const handleMissionControl = async (action: 'start' | 'pause' | 'abort') => {
    try {
      const statusMap: Record<string, 'running' | 'paused' | 'aborted'> = {
        start: 'running',
        pause: 'paused',
        abort: 'aborted',
      };

      const { error } = await supabase
        .from('missions')
        .update({
          status: statusMap[action],
          started_at: action === 'start' ? new Date().toISOString() : mission.started_at,
          completed_at: action === 'abort' ? new Date().toISOString() : null,
        })
        .eq('id', id);

      socket.emit('mission-control', {
        missionId: id,
        action,
      })

      if (error) throw error;

      toast({ title: `Mission ${action}ed successfully` });
      loadMissionData();
    } catch (error: any) {
      toast({
        title: 'Error controlling mission',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading mission...</p>
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Mission not found</p>
      </div>
    );
  }

  const progress = mission.status === 'completed' ? 100 : mission.status === 'running' ? 45 : 0;

  return (
    <div className="h-screen flex flex-col md:flex-row items-stretch bg-background">
      <MissionSidebar
        selectedDrone={selectedDrone}
        handleSelectDrone={handleSelectDrone}
        mission={mission}
        alerts={alerts}
        mapStyle={mapStyle}
        handleMapStyleChange={(style) => setMapStyle(style)}
        handleMissionControl={handleMissionControl}
        progress={progress}
      />
      <MissionDetailsMap
        mission={mission}
        mapStyle={mapStyle}
      />
    </div>
  );
};
