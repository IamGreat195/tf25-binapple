import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { OSM, XYZ } from 'ol/source';
import { fromLonLat } from 'ol/proj';
import { Feature } from 'ol';
import { Point, LineString, Polygon } from 'ol/geom';
import { Style, Stroke, Fill, Icon, Circle as CircleStyle, Text } from 'ol/style';
import 'ol/ol.css';
import { Database } from '@/integrations/supabase/types';
import { useSocket } from '@/contexts/SocketContext';

type Mission = Database['public']['Tables']['missions']['Row'] & {
  fields: Database['public']['Tables']['fields']['Row'] | null
}

interface MissionDetailsMapProps {
  mission: Mission,
  mapStyle: 'osm' | 'satellite' | 'terrain' | 'dark',
}

const createWayPointIcon = (label: string) => 'data:image/svg+xml;base64,' + btoa(`
  <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
    <circle cx="15" cy="15" r="12" fill="#fbbf24" stroke="#f59e0b" stroke-width="2"/>
    <text x="15" y="20" text-anchor="middle" font-size="14" font-weight="bold" fill="#78350f">${label}</text>
  </svg>
`);

const createDroneIcon = () => 'data:image/svg+xml;base64,' + btoa(`
  <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="6" fill="#3b82f6" stroke="#1e40af" stroke-width="1.5"/>
    <line x1="20" y1="20" x2="8" y2="8" stroke="#1e40af" stroke-width="2"/>
    <line x1="20" y1="20" x2="32" y2="8" stroke="#1e40af" stroke-width="2"/>
    <line x1="20" y1="20" x2="8" y2="32" stroke="#1e40af" stroke-width="2"/>
    <line x1="20" y1="20" x2="32" y2="32" stroke="#1e40af" stroke-width="2"/>
    <circle cx="8" cy="8" r="4" fill="#60a5fa" stroke="#1e40af" stroke-width="1"/>
    <circle cx="32" cy="8" r="4" fill="#60a5fa" stroke="#1e40af" stroke-width="1"/>
    <circle cx="8" cy="32" r="4" fill="#60a5fa" stroke="#1e40af" stroke-width="1"/>
    <circle cx="32" cy="32" r="4" fill="#60a5fa" stroke="#1e40af" stroke-width="1"/>
    <path d="M 20 14 L 23 20 L 20 19 L 17 20 Z" fill="#ef4444"/>
  </svg>
`);

const hexToRgba = (hex: string, alpha: number) => {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function MissionDetailsMap({ mission, mapStyle }: MissionDetailsMapProps) {
  const { latestTelemetry } = useSocket();
  const lastTelemetry = latestTelemetry[latestTelemetry.length - 1] ?? null;

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const baseLayer = useRef<TileLayer<any> | null>(null);
  const fieldSource = useRef(new VectorSource());
  const pathSource = useRef(new VectorSource());
  const droneSource = useRef(new VectorSource());
  const telemetrySource = useRef(new VectorSource());
  const droneFeature = useRef<Feature | null>(null);

  const [mapReady, setMapReady] = useState(false);

  const getBaseSource = (style: string) => {
    switch (style) {
      case 'satellite':
        return new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attributions: 'Tiles © Esri',
          maxZoom: 19,
        });
      case 'terrain':
        return new XYZ({
          url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
          attributions: '© OpenTopoMap contributors',
          maxZoom: 17,
        });
      case 'dark':
        return new XYZ({
          url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          attributions: '© CARTO',
          maxZoom: 19,
        });
      case 'osm':
      default:
        return new OSM();
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    baseLayer.current = new TileLayer({ source: getBaseSource(mapStyle) });

    const fieldLayer = new VectorLayer({
      source: fieldSource.current,
      style: new Style({
        stroke: new Stroke({ color: '#22c55e', width: 3 }),
        fill: new Fill({ color: 'rgba(34, 197, 94, 0.1)' }),
      }),
      zIndex: 1,
    });

    const pathLayer = new VectorLayer({
      source: pathSource.current,
      style: (feature) => {
        const geom = feature.getGeometry();
        if (geom instanceof Point) {
          return new Style({ image: new Icon({ src: createWayPointIcon(feature.get('label')), scale: 1 }) });
        }
        return new Style({ stroke: new Stroke({ color: '#ef4444', width: 3, lineDash: [10, 5] }) });
      },
      zIndex: 2,
    });

    const droneLayer = new VectorLayer({
      source: droneSource.current,
      style: new Style({ image: new Icon({ src: createDroneIcon(), scale: 1, anchor: [0.5, 0.5] }) }),
      zIndex: 3,
    });

    const telemetryLayerInstance = new VectorLayer({
      source: telemetrySource.current,
      zIndex: 4,
      style: (feature) => {
        const yieldScore = feature.get('yieldScore');
        const weedScore = feature.get('weedScore');
        const infectionScore = feature.get('infectionScore');

        let color = '#fff';
        let opacity = 0.5;

        if (yieldScore !== undefined) {
          color = '#22c55e';
          opacity = Math.min(yieldScore / 2, 1);
        }
        if (weedScore !== undefined) {
          color = '#facc15';
          opacity = Math.min(weedScore / 3, 1);
        }
        if (infectionScore !== undefined) {
          color = '#ef4444';
          opacity = infectionScore === 100 ? 0.5 : 0.1;
        }

        return new Style({
          image: new CircleStyle({
            radius: 6, // smaller
            fill: new Fill({ color: hexToRgba(color, opacity) }),
            stroke: new Stroke({ color, width: 1 }),
          }),
//           text: new Text({
//             text: `
// Y:${yieldScore ?? '-'}
// W:${weedScore ?? '-'}
// I:${infectionScore ?? '-'}
//         `,
//             font: '10px monospace',
//             fill: new Fill({ color: '#000' }),
//             offsetY: -14,
//           }),
        });
      },
    });

    mapInstance.current = new Map({
      target: mapRef.current,
      layers: [baseLayer.current, fieldLayer, pathLayer, droneLayer, telemetryLayerInstance],
      view: new View({ center: fromLonLat([78, 11]), zoom: 2 }),
    });

    setMapReady(true);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.setTarget(undefined);
        mapInstance.current = null;
      }
    };
  }, []);

  // Change base map style
  useEffect(() => {
    if (!mapReady || !baseLayer.current) return;
    baseLayer.current.setSource(getBaseSource(mapStyle));
  }, [mapReady, mapStyle]);

  // Draw field polygon
  useEffect(() => {
    if (!mapReady || (!mission.fields?.polygon as any)?.length) return;
    fieldSource.current.clear();

    const coords = (mission.fields.polygon as any).map((c: number[]) => fromLonLat(c));
    coords.push(coords[0]);
    const polygon = new Polygon([coords]);
    fieldSource.current.addFeature(new Feature({ geometry: polygon }));

    const extent = polygon.getExtent();
    if (extent.every(Number.isFinite)) {
      mapInstance.current?.getView().fit(extent, { padding: [80, 80, 80, 80], duration: 0 });
    }
  }, [mapReady, mission.fields?.polygon]);

  // Draw pathline & waypoints
  useEffect(() => {
    if (!mapReady) return;
    pathSource.current.clear();

    if ((mission.pathline as any)?.length) {
      const coords = (mission.pathline as any).map((c: number[]) => fromLonLat(c));
      const lineFeature = new Feature({ geometry: new LineString(coords) });
      pathSource.current.addFeature(lineFeature);

      coords.forEach((coord, i) => {
        pathSource.current.addFeature(new Feature({ geometry: new Point(coord), label: (i + 1).toString() }));
      });

      if (!(mission.fields?.polygon as any)?.length) {
        const extent = lineFeature.getGeometry()?.getExtent();
        if (extent && extent.every(Number.isFinite)) {
          mapInstance.current?.getView().fit(extent, { padding: [80, 80, 80, 80], duration: 0 });
        }
      }
    }
  }, [mapReady, mission.pathline, mission.fields?.polygon]);

  // Initialize drone
  useEffect(() => {
    if (!mapReady || droneFeature.current) return;

    if ((mission.pathline as any)?.length) {
      const coords = (mission.pathline as any).map((c: number[]) => fromLonLat(c));
      const startPoint = new Point(coords[0]);
      droneFeature.current = new Feature({ geometry: startPoint });
      droneSource.current.addFeature(droneFeature.current);
    }
  }, [mapReady, mission.pathline]);

  // Update drone position
  useEffect(() => {
    if (!mapReady || !lastTelemetry) return;

    const projected = fromLonLat([lastTelemetry.latitude, lastTelemetry.longitude]);

    // Don't clear previous dots → just add
    telemetrySource.current.addFeature(
      new Feature({
        geometry: new Point(projected),
        yieldScore: lastTelemetry.yield_score,
        weedScore: lastTelemetry.weed_score,
        infectionScore: lastTelemetry.infection_score,
      })
    );

    // Move drone
    if (droneFeature.current) {
      droneFeature.current.setGeometry(new Point(projected));
    }

  }, [mapReady, lastTelemetry]);

  return (
    <div className="relative w-full grow h-full">
      <div ref={mapRef} className="w-full h-full rounded-lg border border-border" />
      {/* Telemetry Info Boxes */}
      {lastTelemetry && (
        <div className="absolute top-4 right-4 space-y-2">
          <div className="bg-card border border-border rounded-lg px-4 py-2 shadow-lg">
            <p className="text-xs text-muted-foreground">Drone Position</p>
            <p className="text-sm font-mono">
              {lastTelemetry.latitude.toFixed(2)}°, {lastTelemetry.longitude.toFixed(2)}°
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-2 shadow-lg">
            <p className="text-xs text-muted-foreground">Altitude</p>
            <p className="text-lg font-bold">{lastTelemetry.altitude_meters.toFixed(2)} m</p>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-2 shadow-lg">
            <p className="text-xs text-muted-foreground">Battery</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${lastTelemetry.battery_percent > 50 ? 'bg-green-500' :
                    lastTelemetry.battery_percent > 20 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                  style={{ width: `${lastTelemetry.battery_percent.toFixed(2)}%` }}
                />
              </div>
              <span className="text-sm font-bold">{Math.round(lastTelemetry.battery_percent)}%</span>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-2 shadow-lg">
            <p className="text-xs text-muted-foreground">Yield / Weed / Infection</p>
            <p className="text-sm font-mono">
              Y: {lastTelemetry.yield_score?.toFixed(1) ?? '-'} | W: {lastTelemetry.weed_score ?? '-'} | I: {lastTelemetry.infection_score ?? '-'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
