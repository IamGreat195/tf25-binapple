import { Database } from '@/integrations/supabase/types'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Pause, Play, StopCircle, Globe, Satellite, Mountain, Moon, Airplay } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { DroneType, useSocket } from '@/contexts/SocketContext'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Progress } from '../ui/progress'

type Mission = Database['public']['Tables']['missions']['Row'] & {
  fields: Database['public']['Tables']['fields']['Row'] | null
}

type Alert = Database['public']['Tables']['alerts']['Row']

export default function MissionSidebar({
  selectedDrone,
  handleSelectDrone,
  mission,
  alerts,
  mapStyle,
  handleMissionControl,
  handleMapStyleChange,
  progress,
}: {
  selectedDrone: DroneType | null
  handleSelectDrone: (droneId: string) => void
  mission: Mission
  mapStyle: 'osm' | 'satellite' | 'terrain' | 'dark'
  handleMapStyleChange: (style: 'osm' | 'satellite' | 'terrain' | 'dark') => void
  alerts: Alert[]
  handleMissionControl: (action: 'start' | 'pause' | 'abort') => void
  progress: number
}) {
  const { availableDrones, latestTelemetry } = useSocket()
  const lastTelemetry = latestTelemetry[latestTelemetry.length - 1] ?? null

  return (
    <div className="p-4 h-full flex flex-col gap-4 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/missions" className="text-sm text-primary hover:underline">
            &larr; Back
          </Link>
          <h2 className="text-lg font-bold">{mission.name}</h2>
          <p className="text-xs text-muted-foreground">
            {mission.fields?.name || 'Unknown Field'}
          </p>
        </div>
        <Badge variant={
          mission.status === 'running' ? 'default' :
            mission.status === 'aborted' ? 'destructive' : 'outline'
        }>
          {mission.status}
        </Badge>
      </div>

      {/* Map Style Controls */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Map Style</p>
        <div className="flex gap-1">
          {[
            { key: 'osm', icon: <Globe className="w-4 h-4" />, label: 'Default' },
            { key: 'satellite', icon: <Satellite className="w-4 h-4" />, label: 'Satellite' },
            { key: 'terrain', icon: <Mountain className="w-4 h-4" />, label: 'Terrain' },
            { key: 'dark', icon: <Moon className="w-4 h-4" />, label: 'Dark' },
          ].map(({ key, icon, label }) => (
            <Button
              key={key}
              size="icon"
              variant={mapStyle === key ? 'default' : 'outline'}
              title={label}
              onClick={() => handleMapStyleChange(key as any)}
              className={cn('w-8 h-8')}
            >
              {icon}
            </Button>
          ))}
        </div>
      </div>

      {/* Drone Selector */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">
          Online Drones: <span className="font-medium">
            {availableDrones.filter(d => d.status !== 'disconnected').length}
          </span>
        </p>

        <Select
          value={selectedDrone?.droneId || 'nil'}
          onValueChange={handleSelectDrone}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select Drone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nil">
              <div className="flex items-center justify-between w-full">
                <span className="mx-2">-- Unassigned --</span>
              </div>
            </SelectItem>

            {availableDrones.length > 0 ? availableDrones.map(drone => (
              <SelectItem
                disabled={drone.status !== 'idle'}
                key={drone.droneId}
                value={drone.droneId}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="mx-2">{drone.droneId}</span>
                  <Badge variant="secondary">
                    {drone.missionId === mission.id ? "Selected" : drone.status}
                  </Badge>
                </div>
              </SelectItem>
            )) : (
              <div className="p-2 text-xs text-muted-foreground">No drones available</div>
            )}
          </SelectContent>
        </Select>

        {selectedDrone?.status === 'disconnected' && (
          <div className="flex items-center mt-1 text-destructive text-xs">
            <Airplay className="w-4 h-4 mr-1" />
            Drone is disconnected
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 flex-1 overflow-auto">
        {/* Mission Controls */}
        <div className="flex justify-between gap-2">
          <Button onClick={() => handleMissionControl('start')} disabled={mission.status === 'running' || !selectedDrone} size="sm"><Play className="w-4 h-4 mr-1" />Start</Button>
          <Button onClick={() => handleMissionControl('pause')} disabled={mission.status !== 'running'} size="sm"><Pause className="w-4 h-4 mr-1" />Pause</Button>
          <Button onClick={() => handleMissionControl('abort')} disabled={['completed', 'aborted'].includes(mission.status)} size="sm" variant="destructive"><StopCircle className="w-4 h-4 mr-1" />Abort</Button>
        </div>

        {/* Mission Details */}
        <div className="bg-muted/10 p-2 rounded text-xs grid grid-cols-2 gap-1">
          <div>📝 Type: <span className="font-medium capitalize">{mission.mission_type}</span></div>
          <div>🛬 Altitude: <span className="font-medium">{mission.altitude_meters.toFixed(1)} m</span></div>
          <div>💨 Speed: <span className="font-medium">{mission.speed_ms.toFixed(1)} m/s</span></div>
          {mission.started_at && <div>🕒 Started: <span className="font-medium">{new Date(mission.started_at).toLocaleString()}</span></div>}
        </div>

        {/* Progress & Telemetry */}
        <div className="bg-muted/10 p-2 rounded space-y-2 text-xs">
          {/* Mission Progress */}
          <div className="flex flex-col items-center">
            <p className="text-sm font-semibold mb-2">Mission Progress</p>
            <Progress
              value={lastTelemetry?.progress ?? progress}
              className="h-6 w-full rounded-full"
            />
            <p className="mt-1 text-sm font-bold">
              {lastTelemetry?.progress ?? progress}%
            </p>
          </div>

          {/* Telemetry Details */}
          {lastTelemetry && (
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
              <div>📍 Lat: {lastTelemetry.latitude.toFixed(4)}°</div>
              <div>📍 Lon: {lastTelemetry.longitude.toFixed(4)}°</div>
              <div>🛫 Alt: {lastTelemetry.altitude_meters.toFixed(1)} m</div>
              <div>💨 Speed: {lastTelemetry.speed_ms.toFixed(1)} m/s</div>
              <div>🔋 Battery: {lastTelemetry.battery_percent.toFixed(0)}%</div>
            </div>
          )}
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-1 text-xs text-destructive">
            {alerts.map(alert => (
              <div key={alert.id} className="bg-destructive/10 p-1 rounded flex justify-between">
                <span className="font-medium">{alert.alert_type}</span>
                <span className="truncate">{alert.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
