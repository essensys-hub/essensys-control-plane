import type {
  ServiceInfo,
  VersionInfo,
  ExchangeEntry,
  ClientInfo,
  Action,
  RedisInfo,
  KeyInfo,
  AuditEntry,
  UpdateHistoryEntry,
  SystemInfo,
  HealthInfo,
} from '../types'

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '') || ''
const BASE = BASE_PATH + '/api'

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

// --- Services ---
export const services = {
  list: () => fetchJSON<ServiceInfo[]>('/services'),
  get: (name: string) => fetchJSON<{ service: ServiceInfo; details: Record<string, unknown> }>(`/services/${name}`),
  restart: (name: string) => fetchJSON<{ status: string }>(`/services/${name}/restart`, { method: 'POST' }),
  update: (name: string, tag: string) =>
    fetchJSON<{ status: string }>(`/services/${name}/update`, {
      method: 'POST',
      body: JSON.stringify({ tag }),
    }),
  rollback: (name: string) => fetchJSON<{ status: string }>(`/services/${name}/rollback`, { method: 'POST' }),
}

// --- Versions ---
export const versions = {
  list: () => fetchJSON<VersionInfo[]>('/versions'),
  check: () => fetchJSON<{ updates_available: boolean; versions: VersionInfo[] }>('/update/check', { method: 'POST' }),
  history: (service?: string) =>
    fetchJSON<UpdateHistoryEntry[]>(`/updates/history${service ? `?service=${service}` : ''}`),
}

// --- Redis Exchange ---
export const exchange = {
  getTable: (clientID = 'default') => fetchJSON<ExchangeEntry[]>(`/redis/exchange/${clientID}`),
  getValue: (clientID: string, index: number) =>
    fetchJSON<{ index: number; value: string }>(`/redis/exchange/${clientID}/${index}`),
  setValue: (clientID: string, index: number, value: string) =>
    fetchJSON<{ index: number; old_value: string; new_value: string }>(`/redis/exchange/${clientID}/${index}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),
  search: (clientID: string, query: string) =>
    fetchJSON<ExchangeEntry[]>(`/redis/exchange/${clientID}/search?q=${encodeURIComponent(query)}`),
}

// --- Redis Clients ---
export const clients = {
  list: () => fetchJSON<ClientInfo[]>('/redis/clients'),
  get: (clientID: string) => fetchJSON<ClientInfo>(`/redis/clients/${clientID}`),
}

// --- Redis Actions ---
export const actions = {
  list: () => fetchJSON<Action[]>('/redis/actions'),
  push: (action: Partial<Action>) =>
    fetchJSON<{ status: string }>('/redis/actions', {
      method: 'POST',
      body: JSON.stringify(action),
    }),
  remove: (guid: string) => fetchJSON<{ status: string }>(`/redis/actions/${guid}`, { method: 'DELETE' }),
  purge: () => fetchJSON<{ status: string; purged: number }>('/redis/actions', { method: 'DELETE' }),
}

// --- Redis Monitor ---
export const redisMonitor = {
  info: () => fetchJSON<RedisInfo>('/redis/info'),
  keys: () => fetchJSON<KeyInfo[]>('/redis/keys'),
  backup: () =>
    fetch(BASE + '/redis/backup', { method: 'POST' }).then((r) => r.json()),
  restore: (data: Record<string, unknown>) =>
    fetchJSON<{ status: string; restored: number }>('/redis/restore', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// --- Logs ---
export const logs = {
  get: (service: string, lines = 100) => fetchJSON<{ service: string; lines: string }>(`/logs/${service}?lines=${lines}`),
  getAll: (lines = 20) => fetchJSON<Record<string, string>>(`/logs/all?lines=${lines}`),
}

// --- System ---
export const system = {
  get: () => fetchJSON<SystemInfo>('/system'),
  health: () => fetchJSON<HealthInfo>('/system/health'),
}

// --- Audit ---
export const audit = {
  list: (limit = 50, key?: string) =>
    fetchJSON<AuditEntry[]>(`/audit?limit=${limit}${key ? `&key=${key}` : ''}`),
}

// --- Prometheus ---
export const prometheus = {
  query: (query: string) =>
    fetchJSON<{ status: string; data: { resultType: string; result: Array<{ metric: Record<string, string>; value: [number, string] }> } }>(
      `/prometheus/query?query=${encodeURIComponent(query)}`
    ),
  queryRange: (query: string, start: number, end: number, step: number) =>
    fetchJSON<{ status: string; data: { resultType: string; result: Array<{ metric: Record<string, string>; values: Array<[number, string]> }> } }>(
      `/prometheus/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`
    ),
  alerts: () =>
    fetchJSON<{ status: string; data: { alerts: Array<{ labels: Record<string, string>; annotations: Record<string, string>; state: string; activeAt: string; value: string }> } }>(
      '/prometheus/alerts'
    ),
  rules: () =>
    fetchJSON<{ status: string; data: { groups: Array<{ name: string; rules: Array<{ name: string; query: string; state: string; alerts: unknown[]; labels: Record<string, string>; annotations: Record<string, string>; type: string }> }> } }>(
      '/prometheus/rules'
    ),
  targets: () =>
    fetchJSON<{ status: string; data: { activeTargets: Array<{ labels: Record<string, string>; health: string; lastScrape: string; scrapeUrl: string }> } }>(
      '/prometheus/targets'
    ),
}

// --- Alertmanager ---
export const alertmanager = {
  alerts: () =>
    fetch(BASE + '/alertmanager/alerts').then(r => r.json()),
  silences: () =>
    fetch(BASE + '/alertmanager/silences').then(r => r.json()),
}

// --- WebSocket helpers ---
export function createWebSocket(path: string): WebSocket {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return new WebSocket(`${proto}//${window.location.host}${BASE_PATH}/api${path}`)
}
