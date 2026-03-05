const API_URL = `${import.meta.env.VITE_API_URL || ""}/api`;

export async function fetchStations(): Promise<StationsResponse> {
  const response = await fetch(`${API_URL}/stations`);
  if (!response.ok) {
    throw new Error("Failed to fetch stations");
  }
  return response.json();
}

export interface FetchTracksParams {
  stationIds?: string;
  query?: string;
  from?: string;
  to?: string;
  createdBefore?: string;
}

export interface FetchFavoriteTracksParams {
  query?: string;
  from?: string;
  to?: string;
  favoritedBefore?: string;
}

export interface FetchAnalyticsParams {
  stationIds?: string;
  query?: string;
  from?: string;
  to?: string;
}

export interface FetchAlertEventsParams {
  limit?: number;
}

/**
 * Convert a local date string (YYYY-MM-DD) + time to a naive UTC datetime
 * string suitable for the backend (which stores naive UTC datetimes).
 */
function localDateToUTC(date: string, time: string): string {
  // Parsing without "Z" makes the Date constructor treat it as local time
  const local = new Date(`${date}T${time}`);
  // toISOString always returns UTC; strip the trailing "Z" so the backend
  // parses it as a naive (timezone-unaware) datetime.
  return local.toISOString().slice(0, -1);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchTracks(params: FetchTracksParams = {}): Promise<TracksResponse> {
  const searchParams = new URLSearchParams();
  if (params.stationIds) searchParams.set("station-ids", params.stationIds);
  if (params.query) searchParams.set("query", params.query);
  if (params.from) searchParams.set("from", localDateToUTC(params.from, "06:00:00"));
  if (params.to) searchParams.set("to", localDateToUTC(addDays(params.to, 1), "05:59:59.999"));
  if (params.createdBefore) searchParams.set("created-before", params.createdBefore);

  const qs = searchParams.toString();
  const url = `${API_URL}/tracks${qs ? `?${qs}` : ""}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch tracks");
  }
  return response.json();
}

export async function fetchFavoriteTracks(
  params: FetchFavoriteTracksParams = {},
): Promise<TracksResponse> {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set("query", params.query);
  if (params.from) searchParams.set("from", localDateToUTC(params.from, "00:00:00"));
  if (params.to) searchParams.set("to", localDateToUTC(params.to, "23:59:59.999"));
  if (params.favoritedBefore) searchParams.set("favorited-before", params.favoritedBefore);

  const qs = searchParams.toString();
  const url = `${API_URL}/tracks/favorite${qs ? `?${qs}` : ""}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch tracks");
  }
  return response.json();
}

export async function favoriteTrack(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/tracks/${id}/favorite`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to favorite track");
  }
}

export async function unfavoriteTrack(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/tracks/${id}/favorite`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to unfavorite track");
  }
}

export interface CreateStation {
  name: string;
  url: string;
  logoUrl?: string | null;
  enabled: boolean;
  interval: number;
  skipSeconds: number;
}

export interface UpdateStation {
  name: string;
  url: string;
  logoUrl?: string | null;
  enabled: boolean;
  interval: number;
  skipSeconds: number;
}

export async function createStation(data: CreateStation): Promise<{ id: number }> {
  const response = await fetch(`${API_URL}/stations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to create station");
  }
  return response.json();
}

export async function updateStation(id: number, data: UpdateStation): Promise<void> {
  const response = await fetch(`${API_URL}/stations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update station");
  }
}

export async function deleteStation(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/stations/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete station");
  }
}

export async function deleteTrack(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/tracks/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete track");
  }
}

export async function uploadStationLogo(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/uploads/station-logo`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error("Failed to upload station logo");
  }
  const data = (await response.json()) as { url: string };
  return data.url;
}

export interface TrackResponse {
  id: number;
  stationId?: number;
  stationName?: string;
  stationLogoUrl?: string | null;
  title: string;
  artist: string | null;
  album: string | null;
  year: number | null;
  genre: string | null;
  coverUrl: string | null;
  previewUrl: string | null;
  confidenceScore: number | null;
  shazamUrl: string | null;
  favoriteAt: string | null;
  createdAt: string;
  totalPlays?: number;
}

export interface TracksResponse {
  tracks: TrackResponse[];
}

export interface StationResponse {
  id: number;
  name: string;
  url: string;
  logoUrl: string | null;
  enabled: boolean;
  interval: number;
  skipSeconds: number;
  lastRunAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  currentTrack: TrackResponse | null;
}

export interface StationsResponse {
  stations: StationResponse[];
}

// Analytics types
export interface AnalyticsTopSongItem {
  title: string;
  artist: string | null;
  album: string | null;
  count: number;
}

export interface AnalyticsTopArtistItem {
  artist: string | null;
  count: number;
}

export interface AnalyticsTopGenreItem {
  genre: string | null;
  count: number;
}

export interface AnalyticsTopStationItem {
  stationId: number;
  stationName: string;
  count: number;
  songsPerHour?: number | null;
}

export interface AnalyticsTopYearItem {
  year: number | null;
  count: number;
}

export interface AnalyticsHourTopYearsItem {
  hour: number;
  years: AnalyticsTopYearItem[];
}

export interface AnalyticsExclusiveSongItem {
  title: string;
  artist: string | null;
  album: string | null;
  count: number;
}

export interface AnalyticsExclusiveStationSongsItem {
  stationName: string;
  songs: AnalyticsExclusiveSongItem[];
}

function buildAnalyticsQueryString(params: FetchAnalyticsParams): string {
  const searchParams = new URLSearchParams();
  if (params.stationIds) searchParams.set("station-ids", params.stationIds);
  if (params.query) searchParams.set("query", params.query);
  if (params.from) searchParams.set("from", localDateToUTC(params.from, "06:00:00"));
  if (params.to) searchParams.set("to", localDateToUTC(addDays(params.to, 1), "05:59:59.999"));
  return searchParams.toString();
}

export interface AnalyticsResponse {
  totalPlays: number;
  uniqueTracks: number;
  uniqueArtists: number;
  uniqueGenres: number;
  averageConfidenceScore?: number | null;
  lowConfidencePlays?: number;
  topSongs: AnalyticsTopSongItem[];
  topArtists: AnalyticsTopArtistItem[];
  topGenres: AnalyticsTopGenreItem[];
  topStations: AnalyticsTopStationItem[];
  topYears: AnalyticsTopYearItem[];
  topYearsByHour: AnalyticsHourTopYearsItem[];
  exclusiveStationSongs: AnalyticsExclusiveStationSongsItem[];
}

export interface CompetitiveAnalyticsPoint {
  hour: string;
  stations: Record<string, number>;
}

export interface CompetitiveAnalyticsResponse {
  points: CompetitiveAnalyticsPoint[];
}

export interface AlertRule {
  id: number;
  name: string;
  query: string;
  stationId: number | null;
  minIntervalMinutes: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlertRulePayload {
  name: string;
  query: string;
  stationId?: number | null;
  minIntervalMinutes: number;
  enabled: boolean;
}

export interface AlertRulesResponse {
  rules: AlertRule[];
}

export interface AlertEvent {
  id: number;
  ruleId: number;
  stationId: number;
  stationName: string;
  trackId: number;
  trackTitle: string;
  message: string;
  metadataJson: string | null;
  createdAt: string;
}

export interface AlertEventsResponse {
  events: AlertEvent[];
}

export async function fetchAnalytics(
  params: FetchAnalyticsParams = {},
): Promise<AnalyticsResponse> {
  const qs = buildAnalyticsQueryString(params);
  const url = `${API_URL}/analytics${qs ? `?${qs}` : ""}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch analytics");
  return response.json();
}

export async function fetchCompetitiveAnalytics(
  params: FetchAnalyticsParams = {},
): Promise<CompetitiveAnalyticsResponse> {
  const qs = buildAnalyticsQueryString(params);
  const url = `${API_URL}/analytics/competitive${qs ? `?${qs}` : ""}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch competitive analytics");
  return response.json();
}

export async function fetchAlertRules(): Promise<AlertRulesResponse> {
  const response = await fetch(`${API_URL}/alerts/rules`);
  if (!response.ok) throw new Error("Failed to fetch alert rules");
  return response.json();
}

export async function createAlertRule(payload: AlertRulePayload): Promise<AlertRule> {
  const response = await fetch(`${API_URL}/alerts/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to create alert rule");
  return response.json();
}

export async function updateAlertRule(id: number, payload: AlertRulePayload): Promise<AlertRule> {
  const response = await fetch(`${API_URL}/alerts/rules/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to update alert rule");
  return response.json();
}

export async function deleteAlertRule(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/alerts/rules/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete alert rule");
}

export async function fetchAlertEvents(
  params: FetchAlertEventsParams = {},
): Promise<AlertEventsResponse> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  const response = await fetch(`${API_URL}/alerts/events${qs ? `?${qs}` : ""}`);
  if (!response.ok) throw new Error("Failed to fetch alert events");
  return response.json();
}
