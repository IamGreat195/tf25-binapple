import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { OSM, XYZ } from 'ol/source';
import { Draw, Modify } from 'ol/interaction';
import { fromLonLat, toLonLat } from 'ol/proj';
import { getArea } from 'ol/sphere';
import { Feature } from 'ol';
import { Polygon } from 'ol/geom';
import 'ol/ol.css';
import type { Geometry } from 'ol/geom';

interface FieldMapProps {
  onPolygonChange?: (coordinates: number[][], area: number) => void;
  initialPolygon?: number[][];
  editable?: boolean;
}

const FieldMap = ({ onPolygonChange, initialPolygon, editable = true }: FieldMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const vectorSource = useRef(new VectorSource());
  const drawInteraction = useRef<Draw | null>(null);
  const [area, setArea] = useState(0);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  useEffect(() => {
    if (!mapRef.current) return;

    const vectorLayer = new VectorLayer({
      source: vectorSource.current,
      style: {
        'fill-color': 'rgba(59, 130, 246, 0.2)',
        'stroke-color': '#3b82f6',
        'stroke-width': 2,
      },
    });

    mapInstance.current = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({ source: new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attributions: 'Tiles © Esri',
          maxZoom: 19,
        }) }),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat([78.814925, 10.761827]),
        zoom: 2,
      }),
    });

    // Get user's current location
    if (!initialPolygon && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          mapInstance.current?.getView().setCenter(fromLonLat([longitude, latitude]));
          mapInstance.current?.getView().setZoom(15);
          setIsLoadingLocation(false);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          setIsLoadingLocation(false);
          // Fallback to default view
        }
      );
    } else {
      setIsLoadingLocation(false);
    }

    if (editable) {
      const draw = new Draw({
        source: vectorSource.current,
        type: 'Polygon',
      });

      drawInteraction.current = draw;

      draw.on('drawend', (event) => {
        const geometry = event.feature.getGeometry() as Polygon;
        const coords = geometry.getCoordinates()[0];
        const lonLatCoords = coords.map((coord: number[]) => toLonLat(coord));
        const areaM2 = getArea(geometry);
        const areaHa = areaM2 / 10000;
        
        setArea(areaHa);
        onPolygonChange?.(lonLatCoords, areaHa);
        
        mapInstance.current?.removeInteraction(draw);
        drawInteraction.current = null;
      });

      const modify = new Modify({ source: vectorSource.current });
      modify.on('modifyend', async () => {
        const features = await vectorSource.current.getFeatures();
        if (features.length > 0) {
          const geometry = features[0].getGeometry() as Polygon;
          const coords = geometry.getCoordinates()[0];
          const lonLatCoords = coords.map((coord: number[]) => toLonLat(coord));
          const areaM2 = getArea(geometry);
          const areaHa = areaM2 / 10000;
          
          setArea(areaHa);
          onPolygonChange?.(lonLatCoords, areaHa);
        }
      });

      mapInstance.current.addInteraction(draw);
      mapInstance.current.addInteraction(modify);
    }

    // Handle Escape key to undo last polygon point
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z' && drawInteraction.current) {
        e.preventDefault()
        e.stopImmediatePropagation()
        e.stopImmediatePropagation()
        drawInteraction.current.removeLastPoint();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      mapInstance.current?.setTarget(undefined);
    };
  }, [editable, onPolygonChange]);

  useEffect(() => {
    if (initialPolygon && initialPolygon.length > 0 && mapInstance.current) {
      vectorSource.current.clear();
      const projectedCoords = initialPolygon.map(coord => fromLonLat(coord));
      const polygon = new Polygon([projectedCoords]);
      const feature = new Feature({ geometry: polygon });
      vectorSource.current.addFeature(feature);
      const extent = vectorSource.current.getExtent();
      mapInstance.current.getView().fit(extent, { padding: [50, 50, 50, 50] });
    }
  }, [initialPolygon]);

  return (
    <div className="relative">
      <div ref={mapRef} className="w-full h-[500px] rounded-lg border border-border" />
      
      {!initialPolygon && isLoadingLocation && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-2"></div>
            <p className="text-sm text-muted-foreground">Getting your location...</p>
          </div>
        </div>
      )}
      
      {area > 0 && (
        <div className="absolute top-4 right-4 bg-card border border-border rounded-lg px-4 py-2 shadow-lg">
          <p className="text-sm text-muted-foreground">Area</p>
          <p className="text-lg font-bold text-foreground">{area.toFixed(2)} ha</p>
        </div>
      )}
    </div>
  );
};

export default FieldMap;