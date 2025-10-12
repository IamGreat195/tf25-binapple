import express from 'express'
import http from 'http'
import { Server, Socket } from 'socket.io'
import { config } from 'dotenv'
import supabaseAdmin from './lib/supabase'
import { Database } from './integration/supabase/types'
config({ path: '.env' })

const app = express()
const server = http.createServer(app)

interface DroneInfo {
  droneId: string
  socketId: string
  missionId?: string
  isPaused?: boolean
  status: 'idle' | 'busy' | 'disconnected'
}

type Mission = Database['public']['Tables']['missions']['Row']
type Field = Database['public']['Tables']['fields']['Row']
type MissionWithField = Mission & {
  fields: Field
}

// Map keyed by droneId for easier management
const connectedDrones = new Map<string, DroneInfo>()
const connectedSockets = new Map<string, Socket>()
const recentTelemetry = new Map<string, any[]>()

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['x-app-id'],
  },
})

app.get('/', (_, res) => res.send('Socket.IO server is running'))

io.on('connection', async (socket) => {
  const appId = socket.handshake.query['appId'] as string | undefined
  if (!appId) {
    console.warn('Connection rejected: missing x-app-id')
    socket.disconnect(true)
    return
  }

  console.log('New connection:', socket.id, 'appId:', appId)
  connectedSockets.set(socket.id, socket)

  socket.join(appId)

  socket.onAny(e => {
    console.log(e)
  })

  // Dashboard connection
  if (appId === 'dashboard') {
    // Send current drone state
    io.to("dashboard").emit('available-drones', [...connectedDrones.values()])

    socket.on('mission-control', ({ missionId, action }: {
      missionId: string,
      action: 'start' | 'pause' | 'abort'
    }) => {
      const drone = [...connectedDrones.values()].find(d => d.missionId === missionId)
      if (!drone) return

      connectedDrones.set(drone.droneId, {
        ...drone,
        isPaused: action === 'pause' ? true : action === 'start' ? false : drone.isPaused,
        status: action === 'abort' ? 'idle' : drone.status,
      })

      io.to(drone.socketId).emit('mission-control', { missionId, action })

      io.to("dashboard").emit('available-drones', [...connectedDrones.values()])
    })

    // Handle status updates from dashboard
    socket.on('change-drone-status', async ({ droneId, mission, status }: {
      droneId: string,
      mission: MissionWithField,
      status: 'idle' | 'busy'
    }) => {
      if (!['idle', 'busy'].includes(status)) return

      const droneEntry = connectedDrones.get(droneId)
      if (!droneEntry) return

      const updated: DroneInfo = {
        ...droneEntry,
        status,
        missionId: status === 'busy' ? mission.id : undefined,
      }

      connectedDrones.set(droneId, updated)
      io.to('dashboard').emit('available-drones', [...connectedDrones.values()])

      io.to(droneEntry.droneId).emit('change-drone-status', {
        mission,
        isPaused: true,
        recentTelemetry: recentTelemetry.get(mission.id) || [],
        status
      })

      console.log(`Drone ${droneId} → ${status}${mission.id ? ` (mission ${mission.id})` : ''}`)
    })

    return
  }

  // Drone connection
  socket.join('drones')

  const existing = connectedDrones.get(appId)
  const droneInfo: DroneInfo = {
    droneId: appId,
    socketId: socket.id,
    status: existing?.missionId ? 'busy' : 'idle',
    missionId: existing?.missionId,
  }

  connectedDrones.set(appId, droneInfo)

  if (existing?.missionId) {
    const { data: existingMission } = await supabaseAdmin.from('missions').select('*').eq('id', existing!.missionId).single()

    if (existingMission) {
      io.to(droneInfo.socketId).emit('change-drone-status', {
        mission: existingMission,
        isPaused: existingMission.status === 'paused',
        recentTelemetry: recentTelemetry.get(existingMission.id) || [],
        status: 'busy'
      })
    }
  }

  io.to('dashboard').emit('available-drones', [...connectedDrones.values()])

  socket.on("telemetry", async (data: any) => {
    const AI_URL = process.env.AI_URL || "http://localhost:5000"

    let infectionScore = 0, weedScore = 0, yieldScore = 4.5
    try {
      const res = await fetch(`${AI_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          altitude_meters: data.altitude_meters
        })
      })

      if (res.ok) {
        const aiData = await res.json()
        infectionScore = aiData.infectionScore === "Not Healthy" ? 100 : 0
        weedScore = aiData.weedScore || 0
        yieldScore = aiData.yieldScore || 4.5
      }
    } catch (e) {
      console.error("AI service error:", e)
    }

    let last = recentTelemetry.get(data.mission_id) || []

    data = {
      ...data,
      infection_score: infectionScore,
      weed_score: weedScore,
      yield_score: yieldScore
    }

    last.push(data)

    console.log(last[last.length - 1])

    console.log(last.length)
    if (last.length >= 20) {
      const { error } = await supabaseAdmin.from("telemetry").insert(last)
      console.log("Inserted telemetry batch:", error || "success")
      last = []
    }

    recentTelemetry.set(data.mission_id, last)
    io.to("dashboard").emit("telemetry", { ...data, droneId: appId })
  })

  socket.on("mission-complete", async ({ missionId }) => {
    const drone = connectedDrones.get(appId)
    if (!drone) return

    connectedDrones.set(appId, { ...drone, status: 'idle', missionId: undefined })
    io.to('dashboard').emit('available-drones', [...connectedDrones.values()])

    await supabaseAdmin.from('missions').update({ status: 'completed' }).eq('id', missionId)
  })
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id)
    connectedSockets.delete(socket.id)

    // Mark drone as disconnected
    const drone = [...connectedDrones.values()].find(d => d.socketId === socket.id)
    if (drone) {
      connectedDrones.set(drone.droneId, { ...drone, status: 'disconnected' })
      io.to('dashboard').emit('available-drones', [...connectedDrones.values()])
    }
  })
})

const PORT = process.env.PORT ?? 4000
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`))
