import type { Place } from "../components/PlacePicker";
export interface JourneyStop extends Place {
  sequence: number;
  source_id: number;
}
export interface Journey {
  key: string;
  route_id: number;
  code: string;
  direction_id: number;
  direction_label: string;
  carrier: string;
  tariff_label: string;
  board: JourneyStop;
  alight: JourneyStop;
  stop_count: number;
  walk_to_m: number;
  walk_from_m: number;
  walk_to_minutes?: number;
  walk_from_minutes?: number;
  legs?: {type:'walk'|'bus';from:Place;to:Place;minutes:number;distance_m:number;shape:Place[];estimated?:boolean}[];
  ride_minutes: number;
  planned_minutes: number;
  shape: Place[];
  stops: JourneyStop[];
  stale: boolean;
  mode: "official" | "demo";
  source_url?: string;
  fetched_at?: string;
  ride_time_basis?: 'published_route_duration_scaled'|'assumed_18_kmh';
  walking_status?: 'provider'|'estimate'|'over_limit';
  walking_warnings?: string[];
}
export interface Vehicle {
  vehicle_id: string;
  label: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  ts: string;
  eta_minutes: number;
  destination_minutes: number;
  predictions: { minutes: number; lat: number; lng: number; at: string }[];
}
