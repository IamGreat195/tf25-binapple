import { io, Socket } from "socket.io-client";
import crypto from "node:crypto";
import { Database } from "./integration/supabase/types";

type Telemetry = Database["public"]["Tables"]["telemetry"]["Insert"] & {
  progress?: number;
  temperature?: number;
  current?: number;
  voltage?: number;
};
type Mission = Database["public"]["Tables"]["missions"]["Row"];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function randomFluctuation(value: number, range: number) {
  return value + (Math.random() * 2 - 1) * range;
}
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Approximate conversion of lat/lon degrees to meters in a local tangent plane
 * using a reference latitude (good for short distances).
 */
function latLonToXY(lat: number, lon: number, refLat: number) {
  const metersPerDegLat = 111132.954 - 559.822 * Math.cos((2 * refLat * Math.PI) / 180) + 1.175 * Math.cos((4 * refLat * Math.PI) / 180);
  const metersPerDegLon = (Math.PI / 180) * 6378137 * Math.cos((refLat * Math.PI) / 180);
  return {
    x: lon * metersPerDegLon,
    y: lat * metersPerDegLat,
  };
}

/**
 * Projects point P onto segment AB (lat/lon). Returns:
 *  - t: fraction along AB (0..1)
 *  - distanceToProjection: distance in meters from P to projection
 *  - distAlongSegment: distance in meters from A to projection (0..segLen)
 */
function projectPointOntoSegment(
  Ax: number, Ay: number,
  Bx: number, By: number,
  Px: number, Py: number
) {
  const ABx = Bx - Ax;
  const ABy = By - Ay;
  const APx = Px - Ax;
  const APy = Py - Ay;
  const ab2 = ABx * ABx + ABy * ABy;
  let t = ab2 === 0 ? 0 : (APx * ABx + APy * ABy) / ab2;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  const projx = Ax + ABx * t;
  const projy = Ay + ABy * t;
  const dx = Px - projx;
  const dy = Py - projy;
  const distanceToProjection = Math.sqrt(dx * dx + dy * dy);
  const segLen = Math.sqrt(ab2);
  const distAlongSegment = segLen * t;
  return { t, distanceToProjection, distAlongSegment, segLen };
}

/**
 * Given a polyline (path) and a point (lat/lon), find the segment and fraction along it
 * where the projected point is closest. Returns:
 *  - segmentIndex (the 'A' index)
 *  - t (0..1 fraction along that segment)
 *  - distanceTraveled (meters) along the polyline up to the projected point
 *  - distanceToProjection (meters)
 */
function findClosestPointOnPath(path: [number, number][], lat: number, lon: number, stepsPerSegment: number) {
  if (path.length === 0) return { segmentIndex: 0, t: 0, distanceTraveled: 0, distanceToProjection: 0 };

  // We'll choose a reference latitude approximate (mean of path) for conversion
  const meanLat = path.reduce((s, p) => s + p[0], 0) / path.length;
  // Convert all points to XY once
  const ptsXY = path.map(([plat, plon]) => latLonToXY(plat, plon, meanLat));
  const Pxy = latLonToXY(lat, lon, meanLat);

  // Precompute segment lengths (in meters) using haversine for robustness
  const segLengths: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [lat1, lon1] = path[i];
    const [lat2, lon2] = path[i + 1];
    segLengths.push(haversineDistance(lat1, lon1, lat2, lon2));
  }

  let best = {
    segmentIndex: 0,
    t: 0,
    distanceTraveled: 0,
    distanceToProjection: Infinity,
  };

  // Running sum of full segments before current tested segment
  let prefixSum = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const A = ptsXY[i];
    const B = ptsXY[i + 1];
    const proj = projectPointOntoSegment(A.x, A.y, B.x, B.y, Pxy.x, Pxy.y);
    // Convert proj.distanceToProjection (meters in XY) to meters ~ it's already in meters by our scale
    if (proj.distanceToProjection < best.distanceToProjection) {
      best.distanceToProjection = proj.distanceToProjection;
      best.segmentIndex = i;
      best.t = proj.t;
      best.distanceTraveled = prefixSum + proj.distAlongSegment;
    }
    prefixSum += segLengths[i];
  }

  // Edge case: if path only contains one point
  if (path.length === 1) {
    best.segmentIndex = 0;
    best.t = 0;
    best.distanceTraveled = 0;
    best.distanceToProjection = haversineDistance(path[0][0], path[0][1], lat, lon);
  }

  return best;
}

class DroneSimulator {
  private socket: Socket;
  private droneId: string;
  private mission: Mission | null = null;
  private isPaused = true;
  private battery = 100;
  private altitude = 0;

  // Electrical properties
  private temperature = 35;
  private current = 10;
  private voltage = 11.1;

  private currentWaypointIndex = 0; // index of segment start (A)
  private currentStep = 0;
  private readonly stepsPerSegment = 15;
  private totalDistance = 0;
  private distanceTraveled = 0;

  constructor(serverUrl: string, droneId?: string) {
    this.droneId = droneId ?? `drone-${crypto.randomBytes(4).toString("hex")}`;
    this.socket = io(`${serverUrl}?appId=${this.droneId}`);
    this.setupSocket();
  }

  private setupSocket() {
    this.socket.on("connect", () => {
      console.log(`✅ Connected as ${this.droneId} (${this.socket.id})`);
    });

    this.socket.on("change-drone-status", ({ mission, recentTelemetry, isPaused, status }: {
      mission: Mission;
      recentTelemetry: Telemetry[],
      status: "idle" | "busy",
      isPaused?: boolean
    }) => {
      if (status === "busy") {
        this.mission = mission;
        console.log(`🛰️ Mission assigned: ${mission.name}`);
        this.resetProgress();
        this.computeTotalDistance();

        let restoredProgress = 0;

        if (recentTelemetry && recentTelemetry.length > 0) {
          const last = recentTelemetry[recentTelemetry.length - 1];
          this.altitude = last.altitude_meters ?? 0;
          this.battery = last.battery_percent ?? 100;
          this.temperature = last.temperature ?? 35;
          this.current = last.current ?? 10;
          this.voltage = last.voltage ?? 11.1;
          const lastLat = last.latitude;
          const lastLon = last.longitude;
          const path: [number, number][] = mission.pathline as any;

          // Find closest point on path (segment + frac)
          const closest = findClosestPointOnPath(path, lastLat, lastLon, this.stepsPerSegment);

          // restore internal indexes
          this.currentWaypointIndex = Math.max(0, Math.min(closest.segmentIndex, path.length - 2));
          // derive currentStep from fraction t
          this.currentStep = Math.round(closest.t * this.stepsPerSegment);

          // distanceTraveled restored (meters)
          this.distanceTraveled = closest.distanceTraveled;
          restoredProgress = this.totalDistance > 0 ? (this.distanceTraveled / this.totalDistance) * 100 : 0;

          console.log(
            `📦 Resuming → lat:${lastLat.toFixed(6)} lon:${lastLon.toFixed(6)} alt:${this.altitude}m bat:${this.battery}% progress:${restoredProgress.toFixed(2)}% (segment ${this.currentWaypointIndex} step ${this.currentStep})`
          );

          // Emit restored telemetry snapshot
          this.socket.emit("telemetry", {
            id: crypto.randomUUID(),
            mission_id: this.mission.id,
            latitude: lastLat,
            longitude: lastLon,
            altitude_meters: this.altitude,
            speed_ms: 0,
            battery_percent: Math.round(this.battery),
            timestamp: new Date().toISOString(),
            progress: parseFloat(restoredProgress.toFixed(2)),
            temperature: this.temperature,
            current: this.current,
            voltage: this.voltage,
          });
        } else {
          console.log("🆕 No previous telemetry found — starting fresh.");
          this.altitude = 0;
          this.battery = 100;
        }

        if (!isPaused) {
          this.isPaused = false;
          this.resumeMission(restoredProgress);
        }
      } else {
        console.log("Mission cleared, returning to idle");
        this.mission = null;
        this.isPaused = true;
      }
    });

    this.socket.on("mission-control", ({ action }: { action: "start" | "pause" }) => {
      if (!this.mission) return;
      console.log(`🕹️ Mission control: ${action}`);
      this.isPaused = action !== "start";
      if (!this.isPaused) this.resumeMission();
    });

    this.socket.on("disconnect", () => {
      console.log("❌ Disconnected from server");
      process.exit(1);
    });
  }

  private resetProgress() {
    this.currentWaypointIndex = 0;
    this.currentStep = 0;
    this.altitude = 0;
    this.distanceTraveled = 0;
    this.totalDistance = 0;
  }

  private computeTotalDistance() {
    if (!this.mission?.pathline) return;
    const path: [number, number][] = this.mission.pathline as any;
    this.totalDistance = path.reduce((sum, _, i) => {
      if (i === 0) return 0;
      const [lat1, lon1] = path[i - 1];
      const [lat2, lon2] = path[i];
      return sum + haversineDistance(lat1, lon1, lat2, lon2);
    }, 0);
  }

  private async resumeMission(restoredProgress = 0) {
    if (!this.mission?.pathline) return;
    const path: [number, number][] = this.mission.pathline as any;

    console.log(
      `🚀 Continuing from waypoint ${this.currentWaypointIndex}/${path.length - 1}, progress ${restoredProgress.toFixed(2)}%`
    );

    if (this.currentWaypointIndex === 0 && this.currentStep === 0) {
      await this.rampUpAltitude(this.mission.altitude_meters ?? 100);
    }

    for (let i = this.currentWaypointIndex; i < path.length - 1; i++) {
      const [lat1, lon1] = path[i];
      const [lat2, lon2] = path[i + 1];
      const segmentDistance = haversineDistance(lat1, lon1, lat2, lon2);

      // If we restored inside this segment, start from restored step; otherwise start at 0
      const startStep = i === this.currentWaypointIndex ? this.currentStep : 0;

      for (let step = startStep; step <= this.stepsPerSegment; step++) {
        if (this.isPaused) {
          this.currentWaypointIndex = i;
          this.currentStep = step;
          console.log("⏸️ Paused — progress saved.");
          return;
        }

        const progressAlongSegment = step / this.stepsPerSegment;
        const incrementalDistance = segmentDistance / this.stepsPerSegment;
        this.distanceTraveled += incrementalDistance;

        const altitude = randomFluctuation(this.altitude, 1);
        const speed = randomFluctuation(this.mission.speed_ms ?? 5, 0.5);
        const temperature = randomFluctuation(this.temperature, 0.5);
        const current = randomFluctuation(this.current, 0.2);
        const voltage = randomFluctuation(this.voltage, 0.05);
        this.battery = Math.max(0, randomFluctuation(this.battery - 0.05, 0.02));

        const progressPercent = Math.min(100, (this.distanceTraveled / this.totalDistance) * 100);

        const telemetry: Telemetry = {
          id: crypto.randomUUID(),
          mission_id: this.mission.id,
          latitude: lerp(lat1, lat2, progressAlongSegment),
          longitude: lerp(lon1, lon2, progressAlongSegment),
          altitude_meters: altitude,
          speed_ms: speed,
          battery_percent: Math.round(this.battery),
          timestamp: new Date().toISOString(),
          progress: parseFloat(progressPercent.toFixed(2)),
          temperature,
          current,
          voltage,
        };

        this.socket.emit("telemetry", telemetry);
        console.log(
          `📡 ${telemetry.progress?.toFixed(1)}% | lat:${telemetry.latitude.toFixed(
            6
          )} lon:${telemetry.longitude.toFixed(6)} alt:${altitude.toFixed(1)}m bat:${this.battery.toFixed(
            1
          )}% temp:${temperature.toFixed(1)}°C current:${current.toFixed(2)}A voltage:${voltage.toFixed(2)}V`
        );

        if (progressPercent >= 100) {
          console.log("🎯 Mission complete!");
          this.socket.emit("mission-complete", { missionId: this.mission.id });
          this.resetProgress();
          return;
        }

        await sleep(2000);
      }
      this.currentStep = 0;
    }

    console.log("✅ Mission finished.");
    this.socket.emit("mission-complete", { missionId: this.mission.id });
    this.resetProgress();
  }

  private async rampUpAltitude(target: number) {
    console.log(`⬆️ Ascending to ${target}m...`);
    while (this.altitude < target) {
      if (this.isPaused) {
        await sleep(1000);
        continue;
      }
      this.altitude = Math.min(target, this.altitude + 5);
      this.socket.emit("telemetry", {
        id: crypto.randomUUID(),
        mission_id: this.mission?.id ?? "",
        latitude: 0,
        longitude: 0,
        altitude_meters: this.altitude,
        speed_ms: 0,
        battery_percent: Math.round(this.battery),
        timestamp: new Date().toISOString(),
        progress: 0,
        temperature: this.temperature,
        current: this.current,
        voltage: this.voltage,
      });
      console.log(`🪶 Altitude: ${this.altitude.toFixed(1)}m`);
      await sleep(500);
    }
  }
}

async function main() {
  new DroneSimulator("http://localhost:4000", process.argv[2]);
}

main().catch(console.error);
