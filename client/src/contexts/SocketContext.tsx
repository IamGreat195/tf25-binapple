import { Database } from '@/integrations/supabase/types'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export interface DroneType {
  missionId?: string
  droneId: string
  status: 'idle' | 'busy' | 'disconnected'
}

type Telemetry = Database['public']['Tables']['telemetry']['Row'] & {
  droneId: string
}

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  latestTelemetry: Telemetry[]
  availableDrones: DroneType[]
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  availableDrones: [],
  latestTelemetry: []
})

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [availableDrones, setAvailableDrones] = useState<DroneType[]>([])
  const [latestTelemetry, setLatestTelemetry] = useState<Telemetry[]>([])

  useEffect(() => {
    const s = io('http://localhost:4000?appId=dashboard', {
      transports: ['websocket']
    })

    setSocket(s)

    s.on('connect', () => {
      setIsConnected(true)
      console.log('Socket connected:', s.id)
    })

    s.on('disconnect', (reason) => {
      setIsConnected(false)
      console.warn('Socket disconnected:', reason)
    })

    s.on('available-drones', (drones: DroneType[]) => {
      setAvailableDrones(drones)
    })

    s.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message)
    })
    
    s.on('telemetry', (data: Telemetry) => {
      setLatestTelemetry(prev => prev.concat(data).slice(-10))
    })

    return () => {
      s.disconnect()
    }
  }, [])

  return (
    <SocketContext.Provider value={{ socket, isConnected, availableDrones, latestTelemetry }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
