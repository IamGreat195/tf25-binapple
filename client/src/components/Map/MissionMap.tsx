import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { OSM } from 'ol/source';
import { Draw, Modify } from 'ol/interaction';
import { fromLonLat, toLonLat } from 'ol/proj';
import { getLength } from 'ol/sphere';
import { Feature } from 'ol';
import { LineString, Point, Polygon } from 'ol/geom';
import { Style, Stroke, Circle, Fill, Text } from 'ol/style';
import 'ol/ol.css';
import type { Geometry } from 'ol/geom';

interface MissionMapProps {
  onPathlineChange?: (coordinates: number[][], distance: number) => void;
  fieldPolygon?: number[][];
  initialPathline?: number[][];
  editable?: boolean;
}

const MissionMap = ({ onPathlineChange, fieldPolygon, initialPathline, editable = true }: MissionMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const vectorSource = useRef(new VectorSource());
  const pointsSource = useRef(new VectorSource());
  const drawInteraction = useRef<Draw | null>(null);
  const [distance, setDistance] = useState(0);

  const updatePointLabels = (coordinates: number[][]) => {
    pointsSource.current.clear();
    coordinates.forEach((coord, index) => {
      const pointFeature = new Feature({
        geometry: new Point(coord),
        label: (index + 1).toString(),
      });
      pointsSource.current.addFeature(pointFeature);
    });
  };

  const resetMapPosition = () => {
    if (!mapInstance.current) return;

    if (!fieldPolygon || fieldPolygon.length === 0) {
      mapInstance.current.getView().setCenter(fromLonLat([78, 11]));
      mapInstance.current.getView().setZoom(2);
    } else {
      const projectedCoords = fieldPolygon.map(coord => fromLonLat(coord));
      const extent = [
        Math.min(...projectedCoords.map(c => c[0])),
        Math.min(...projectedCoords.map(c => c[1])),
        Math.max(...projectedCoords.map(c => c[0])),
        Math.max(...projectedCoords.map(c => c[1])),
      ];
      mapInstance.current.getView().fit(extent, { padding: [50, 50, 50, 50] });
    }
  }

  useEffect(() => {
    if (!mapRef.current) return;

    const vectorLayer = new VectorLayer({
      source: vectorSource.current,
      style: new Style({
        stroke: new Stroke({
          color: '#ef4444',
          width: 3,
        }),
      }),
    });

    const pointsLayer = new VectorLayer({
      source: pointsSource.current,
      style: (feature) => {
        return new Style({
          image: new Circle({
            radius: 8,
            fill: new Fill({ color: '#ef4444' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }),
          text: new Text({
            text: feature.get('label'),
            fill: new Fill({ color: '#fff' }),
            font: 'bold 12px sans-serif',
            offsetY: 0,
          }),
        });
      },
    });

    mapInstance.current = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        vectorLayer,
        pointsLayer,
      ],
      view: mapInstance.current?.getView() ?? new View({
        center: fromLonLat([78, 11]),
        zoom: 2,
      }),
    });

    resetMapPosition()

    if (editable) {
      const draw = new Draw({
        source: vectorSource.current,
        type: 'LineString',
        // freehand: true
      });

      drawInteraction.current = draw;

      draw.on('drawend', (event) => {
        const geometry = event.feature.getGeometry() as LineString;
        const coords = geometry.getCoordinates();
        const lonLatCoords = coords.map((coord: number[]) => toLonLat(coord));
        const distanceM = getLength(geometry);
        const distanceKm = distanceM / 1000;
       
        setDistance(distanceKm);
        updatePointLabels(coords);
        onPathlineChange?.(lonLatCoords, distanceKm);
       
        // Fit view to the drawn line
        const extent = geometry.getExtent();
        if (extent && extent.every(val => isFinite(val))) {
          mapInstance.current?.getView().fit(extent, { padding: [50, 50, 50, 50] });
        }
       
        mapInstance.current?.removeInteraction(draw);
        drawInteraction.current = null;
      });

      const modify = new Modify({ source: vectorSource.current });
      modify.on('modifyend', async () => {
        const features = vectorSource.current.getFeatures();
        if (features.length > 0) {
          const geometry = features[0].getGeometry() as LineString;
          const coords = geometry.getCoordinates();
          const lonLatCoords = coords.map((coord: number[]) => toLonLat(coord));
          const distanceM = getLength(geometry);
          const distanceKm = distanceM / 1000;
         
          setDistance(distanceKm);
          onPathlineChange?.(lonLatCoords, distanceKm);
        }
      });

      mapInstance.current.addInteraction(draw);
      mapInstance.current.addInteraction(modify);
    }

    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z' && drawInteraction.current) {
        e.preventDefault();
        drawInteraction.current.removeLastPoint();
      }
      if (e.key === 'Enter' && drawInteraction.current) {
        e.preventDefault();
        e.stopPropagation();
        drawInteraction.current.finishDrawing();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      mapInstance.current?.setTarget(undefined);
    };
  }, [editable, onPathlineChange]);

  useEffect(() => {
    resetMapPosition()
  }, [fieldPolygon]);

  useEffect(() => {
    if (initialPathline && initialPathline.length > 0 && mapInstance.current && vectorSource.current.getFeatures().length === 0) {
      const projectedCoords = initialPathline.map(coord => fromLonLat(coord));
      const lineString = new LineString(projectedCoords);
      const feature = new Feature({ geometry: lineString });
      vectorSource.current.addFeature(feature);
      
      const distanceM = getLength(lineString);
      const distanceKm = distanceM / 1000;
      setDistance(distanceKm);
      
      const extent = lineString.getExtent();
      if (extent && extent.every(val => isFinite(val))) {
        mapInstance.current.getView().fit(extent, { padding: [50, 50, 50, 50] });
      }
    }
  }, [initialPathline]);

  
  useEffect(() => {
    if (fieldPolygon && fieldPolygon.length > 0 && mapInstance.current) {
      vectorSource.current.clear();
      const projectedCoords = fieldPolygon.map(coord => fromLonLat(coord));
      const polygon = new Polygon([projectedCoords]);
      const feature = new Feature({ geometry: polygon });
      feature.setStyle(
        new Style({
          stroke: new Stroke({
        color: '#888', // gray border
        width: 2,
          }),
          fill: new Fill({
        color: 'rgba(128,128,128,0.3)', // semi-transparent gray fill
          }),
        })
      );
      vectorSource.current.addFeature(feature);
      const extent = vectorSource.current.getExtent();
      mapInstance.current.getView().fit(extent, { padding: [50, 50, 50, 50] });
    }
  }, [fieldPolygon]);

  return (
    <div className="relative">
      <div ref={mapRef} className="w-full h-[500px] rounded-lg border border-border" />
      {fieldPolygon === undefined && (
        <div className="absolute inset-0 bg-black/20 grid place-items-center">
          <p className="text-sm text-black">
            Select a field to see its boundary
          </p>
        </div>
      )}
      {distance > 0 && (
        <div className="absolute top-4 right-4 bg-card border border-border rounded-lg px-4 py-2 shadow-lg">
          <p className="text-sm text-muted-foreground">Distance</p>
          <p className="text-lg font-bold text-foreground">{distance.toFixed(2)} km</p>
        </div>
      )}
    </div>
  );
};

export default MissionMap;