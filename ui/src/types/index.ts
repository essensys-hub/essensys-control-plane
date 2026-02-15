// Service types
export interface ServiceInfo {
  name: string
  id: string
  image: string
  tag: string
  status: 'running' | 'stopped' | 'restarting' | 'created' | 'unknown'
  state: string
  created: string
  uptime?: string
  ports?: string
}

export interface VersionInfo {
  service: string
  installed_tag: string
  available_tag?: string
  update_available: boolean
  release_channel: string
}

// Redis types
export interface ExchangeEntry {
  index: number
  value: string
}

export interface ClientInfo {
  client_id: string
  connected: boolean
  ip?: string
  auth?: string
  version?: string
  last_updated?: string
  exchange_count: number
}

export interface Action {
  GUID: string
  type?: string
  params?: Record<string, unknown>
  raw?: string
}

export interface RedisInfo {
  version: string
  uptime_seconds: number
  connected_clients: number
  used_memory_human: string
  used_memory: number
  max_memory_human: string
  total_keys: number
  ops_per_sec: number
  latency_ms: number
}

export interface KeyInfo {
  key: string
  type: string
  size: number
  ttl: number
}

// Audit types
export interface AuditEntry {
  id: number
  timestamp: string
  action: string
  key: string
  old_value?: string
  new_value?: string
  user?: string
}

export interface UpdateHistoryEntry {
  id: number
  timestamp: string
  service: string
  from_tag: string
  to_tag: string
  status: string
  details?: string
}

// System types
export interface SystemInfo {
  timestamp: string
  os: string
  arch: string
  uptime?: string
  memory?: string
  disk?: string
  temperature_raw?: string
  ip?: string
  hostname?: string
  model?: string
}

export interface HealthInfo {
  status: string
  timestamp: string
  version: string
  commit: string
  build: string
}
