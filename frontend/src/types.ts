export interface Route { id: number; code: string; name: string; color: string; surge_level: number }
export interface Stop { id: number; name: string; lat: number; lng: number }
export interface Position { bus_id?: number; route_id?: number; lat: number; lng: number; speed_kmh: number; ts: string }
export interface Bus { id: number; route_id: number; plate: string; capacity: number; position: Position | null }
export type Level = 'low' | 'medium' | 'high' | 'unknown';
export interface Density { route_id: number; score: number; confidence: string; level: Level; ts: string; synthetic: boolean }
export interface Alert { id: number; route_id: number; status: string; started_at: string; resolved_at: string | null; message: string; ai_recommendation: string; recommendation_source: string }
export interface Arrival { bus_id: number; route_id: number; plate: string; eta_minutes: number; crowd_level: Level; crowd_score: number | null; confidence: string; ts: string }
export interface Health { status: string; demo_mode: boolean; alert_window_minutes: number }
export interface ForecastPoint { ts: string; score: number }
export interface Forecast { route_id: number; method: string; synthetic_history: boolean; points: ForecastPoint[] }
