import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Search,
  ChevronDown,
  Play,
  Disc3,
  Users,
  Tag,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  fetchStations,
  fetchAnalytics,
  fetchCompetitiveAnalytics,
  fetchAlertRules,
  fetchAlertEvents,
  createAlertRule,
  deleteAlertRule,
} from "../data/api";
import type { FetchAnalyticsParams, AnalyticsResponse } from "../data/api";
import EmptyState from "../components/EmptyState";

interface AnalyticsSearch {
  stationIds?: string;
  query?: string;
  from?: string;
  to?: string;
}

// Bright palette that stays visible on both light and dark backgrounds
const CHART_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#14b8a6",
  "#22c55e",
  "#eab308",
  "#f97316",
];

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [{ title: "Analytics | Station Tracker" }],
  }),
  validateSearch: (search: Record<string, unknown>): AnalyticsSearch => ({
    stationIds: search.stationIds as string | undefined,
    query: search.query as string | undefined,
    from: search.from as string | undefined,
    to: search.to as string | undefined,
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedStationIds, setSelectedStationIds] = useState<number[]>(() =>
    search.stationIds ? search.stationIds.split(",").map(Number) : []
  );
  const [query, setQuery] = useState(search.query || "");
  const [from, setFrom] = useState(search.from || "");
  const [to, setTo] = useState(search.to || "");

  const fetchParams: FetchAnalyticsParams = {
    stationIds: search.stationIds,
    query: search.query,
    from: search.from,
    to: search.to,
  };

  const { data: stationsData } = useQuery({
    queryKey: ["stations"],
    queryFn: fetchStations,
  });

  const { data: analytics, isLoading: loadingAnalytics } =
    useQuery<AnalyticsResponse>({
      queryKey: ["analytics", fetchParams],
      queryFn: () => fetchAnalytics(fetchParams),
    });
  const { data: competitiveData } = useQuery({
    queryKey: ["analytics-competitive", fetchParams],
    queryFn: () => fetchCompetitiveAnalytics(fetchParams),
  });
  const { data: alertRules } = useQuery({
    queryKey: ["alert-rules"],
    queryFn: fetchAlertRules,
  });
  const { data: alertEvents } = useQuery({
    queryKey: ["alert-events"],
    queryFn: () => fetchAlertEvents({ limit: 30 }),
    refetchInterval: 10_000,
  });

  const createRuleMutation = useMutation({
    mutationFn: createAlertRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-rules"] }),
  });
  const deleteRuleMutation = useMutation({
    mutationFn: deleteAlertRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-rules"] }),
  });

  const [ruleName, setRuleName] = useState("");
  const [ruleQuery, setRuleQuery] = useState("");
  const [ruleStationId, setRuleStationId] = useState<number | null>(null);
  const [ruleCooldown, setRuleCooldown] = useState(30);
  const [brandName, setBrandName] = useState("Station Tracker");

  const toggleStation = (id: number) => {
    setSelectedStationIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      to: "/analytics",
      search: {
        stationIds:
          selectedStationIds.length > 0
            ? selectedStationIds.join(",")
            : undefined,
        query: query || undefined,
        from: from || undefined,
        to: to || undefined,
      },
    });
  };

  const isLoading = loadingAnalytics;
  const clockYears = (analytics?.topYears ?? [])
    .filter((y) => y.year != null)
    .slice(0, 5)
    .map((y) => y.year as number);

  const topYearsByHourMap = new Map(
    (analytics?.topYearsByHour ?? []).map((h) => [h.hour, h.years])
  );

  const radioClockData = Array.from({ length: 24 }, (_, hour) => {
    const row: Record<string, number | string> = {
      hourLabel: `${String(hour).padStart(2, "0")}:00`,
    };
    const years = topYearsByHourMap.get(hour) ?? [];
    for (const year of clockYears) {
      const item = years.find((y) => y.year === year);
      row[`year_${year}`] = item?.count ?? 0;
    }
    return row;
  });
  const stationLines = Array.from(
    new Set(
      (competitiveData?.points ?? []).flatMap((p) => Object.keys(p.stations))
    )
  );
  const competitiveChartData = (competitiveData?.points ?? []).map((p) => ({
    hour: p.hour.slice(11),
    ...p.stations,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Analytics</h1>

      {/* Filter row */}
      <form
        onSubmit={handleSearch}
        className="flex flex-wrap gap-4 mb-8 items-end"
      >
        <div className="flex flex-col gap-1">
          <span className="text-sm">Stations</span>
          <div className="dropdown">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-outline btn-sm gap-1 w-[200px] justify-between"
            >
              <span className="truncate text-left">
                {selectedStationIds.length === 0
                  ? "All stations"
                  : stationsData?.stations
                      .filter((s) => selectedStationIds.includes(s.id))
                      .map((s) => s.name)
                      .join(", ")}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </div>
            <div
              tabIndex={0}
              className="dropdown-content bg-base-200 rounded-box z-10 w-56 p-2 shadow max-h-60 overflow-y-auto"
            >
              {stationsData?.stations.map((station) => (
                <label
                  key={station.id}
                  className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-base-300"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selectedStationIds.includes(station.id)}
                    onChange={() => toggleStation(station.id)}
                  />
                  <span className="text-sm">{station.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm">From</span>
          <input
            type="date"
            className="input input-bordered input-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm">To</span>
          <input
            type="date"
            className="input input-bordered input-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm">Search</span>
          <input
            type="text"
            className="input input-bordered input-sm"
            placeholder="Filter by track, artist, genre..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary btn-sm">
          <Search className="h-4 w-4" />
          Search
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => {
            const report = buildBrandedReportHtml({
              brandName,
              generatedAt: new Date().toLocaleString(),
              analytics,
            });
            const blob = new Blob([report], { type: "text/html;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `weekly-report-${new Date().toISOString().slice(0, 10)}.html`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          disabled={!analytics}
        >
          Export Branded Report
        </button>
        <input
          type="text"
          className="input input-bordered input-sm"
          placeholder="Brand name"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
        />
      </form>

      {/* Summary stats - 4 column layout */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="card bg-base-200 shadow-sm border border-base-300/50 overflow-hidden">
            <div className="card-body flex-row items-center gap-4 p-4">
              <div className="rounded-xl bg-primary/15 p-3 text-primary">
                <Play className="h-7 w-7" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium opacity-80">Total plays</p>
                <p className="text-2xl font-bold tabular-nums">
                  {analytics.totalPlays.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="card bg-base-200 shadow-sm border border-base-300/50 overflow-hidden">
            <div className="card-body flex-row items-center gap-4 p-4">
              <div className="rounded-xl bg-secondary/15 p-3 text-secondary">
                <Disc3 className="h-7 w-7" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium opacity-80">Unique tracks</p>
                <p className="text-2xl font-bold tabular-nums">
                  {analytics.uniqueTracks.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="card bg-base-200 shadow-sm border border-base-300/50 overflow-hidden">
            <div className="card-body flex-row items-center gap-4 p-4">
              <div className="rounded-xl bg-accent/15 p-3 text-accent">
                <Users className="h-7 w-7" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium opacity-80">Unique artists</p>
                <p className="text-2xl font-bold tabular-nums">
                  {analytics.uniqueArtists.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="card bg-base-200 shadow-sm border border-base-300/50 overflow-hidden">
            <div className="card-body flex-row items-center gap-4 p-4">
              <div className="rounded-xl bg-info/15 p-3 text-info">
                <Tag className="h-7 w-7" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium opacity-80">Unique genres</p>
                <p className="text-2xl font-bold tabular-nums">
                  {analytics.uniqueGenres.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="card bg-base-200 shadow-sm border border-base-300/50 overflow-hidden">
            <div className="card-body flex-row items-center gap-4 p-4">
              <div className="rounded-xl bg-success/15 p-3 text-success">
                <BarChart3 className="h-7 w-7" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium opacity-80">Avg quality</p>
                <p className="text-2xl font-bold tabular-nums">
                  {analytics.averageConfidenceScore != null
                    ? `${Math.round(analytics.averageConfidenceScore)}%`
                    : "-"}
                </p>
              </div>
            </div>
          </div>
          <div className="card bg-base-200 shadow-sm border border-base-300/50 overflow-hidden">
            <div className="card-body flex-row items-center gap-4 p-4">
              <div className="rounded-xl bg-warning/15 p-3 text-warning">
                <BarChart3 className="h-7 w-7" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium opacity-80">Low confidence</p>
                <p className="text-2xl font-bold tabular-nums">
                  {(analytics.lowConfidencePlays ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {!isLoading && analytics && (
        <>
          {analytics.totalPlays === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No analytics data yet"
              description="Start tracking stations or adjust your filter to see analytics here."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <BarChartCard
                title="Top 10 played songs"
                data={analytics.topSongs.map((s) => ({
                  name: s.artist ? `${s.title} — ${s.artist}` : s.title,
                  count: s.count,
                  title: s.title,
                  artist: s.artist,
                  album: s.album,
                }))}
                tooltipMode="song"
              />
              <BarChartCard
                title="Top 10 played artists"
                data={analytics.topArtists.map((a) => ({
                  name: a.artist ?? "Unknown",
                  count: a.count,
                }))}
              />
              <BarChartCard
                title="Top 10 years by plays"
                data={analytics.topYears.map((y) => ({
                  name: y.year != null ? String(y.year) : "Unknown",
                  count: y.count,
                }))}
              />
              <BarChartCard
                title="Top 10 played genres"
                data={analytics.topGenres.map((g) => ({
                  name: g.genre ?? "Unknown",
                  count: g.count,
                }))}
              />
              <BarChartCard
                title="Top 10 stations by plays"
                data={analytics.topStations.map((s) => ({
                  name:
                    s.songsPerHour != null
                      ? `${s.stationName} (${s.songsPerHour.toFixed(2)}/h)`
                      : s.stationName,
                  count: s.count,
                }))}
              />
            </div>
          )}
          {!isLoading && analytics.totalPlays > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
              <RadioClockCard
                years={clockYears}
                data={radioClockData}
                empty={(analytics.topYearsByHour ?? []).length === 0}
              />
              <ExclusiveSongsCard data={analytics.exclusiveStationSongs ?? []} />
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-lg">Competitive timeline (per hour)</h2>
                <div className="w-full h-[320px] min-h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={competitiveChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {stationLines.map((stationName, idx) => (
                        <Line
                          key={stationName}
                          type="monotone"
                          dataKey={stationName}
                          stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-lg">Alert rules</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  <input
                    className="input input-bordered input-sm"
                    placeholder="Rule name"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                  />
                  <input
                    className="input input-bordered input-sm"
                    placeholder="Track/artist keyword"
                    value={ruleQuery}
                    onChange={(e) => setRuleQuery(e.target.value)}
                  />
                  <select
                    className="select select-bordered select-sm"
                    value={ruleStationId ?? ""}
                    onChange={(e) =>
                      setRuleStationId(e.target.value ? Number(e.target.value) : null)
                    }
                  >
                    <option value="">All stations</option>
                    {stationsData?.stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="input input-bordered input-sm"
                    value={ruleCooldown}
                    min={0}
                    max={1440}
                    onChange={(e) => setRuleCooldown(Number(e.target.value))}
                    placeholder="Cooldown minutes"
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm mb-3"
                  onClick={() => {
                    if (!ruleName.trim() || !ruleQuery.trim()) return;
                    createRuleMutation.mutate({
                      name: ruleName.trim(),
                      query: ruleQuery.trim(),
                      stationId: ruleStationId,
                      minIntervalMinutes: ruleCooldown,
                      enabled: true,
                    });
                    setRuleName("");
                    setRuleQuery("");
                  }}
                >
                  Add alert rule
                </button>
                <div className="max-h-44 overflow-auto border border-base-300 rounded-lg mb-3">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Query</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {(alertRules?.rules ?? []).map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>{r.query}</td>
                          <td className="text-right">
                            <button
                              className="btn btn-ghost btn-xs text-error"
                              onClick={() => deleteRuleMutation.mutate(r.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3 className="font-semibold text-sm mb-1">Recent alerts</h3>
                <div className="max-h-36 overflow-auto border border-base-300 rounded-lg">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(alertEvents?.events ?? []).map((event) => (
                        <tr key={event.id}>
                          <td className="whitespace-nowrap">
                            {new Date(
                              event.createdAt.endsWith("Z")
                                ? event.createdAt
                                : `${event.createdAt}Z`
                            ).toLocaleString()}
                          </td>
                          <td>{event.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function buildBrandedReportHtml({
  brandName,
  generatedAt,
  analytics,
}: {
  brandName: string;
  generatedAt: string;
  analytics?: AnalyticsResponse;
}) {
  const safeBrand = brandName || "Station Tracker";
  const rows = (analytics?.topSongs ?? [])
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.title)}</td><td>${escapeHtml(s.artist ?? "-")}</td><td>${s.count}</td></tr>`
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>${escapeHtml(safeBrand)} Weekly Report</title>
<style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}</style>
</head><body>
<h1>${escapeHtml(safeBrand)} Weekly Music Report</h1>
<p>Generated: ${escapeHtml(generatedAt)}</p>
<h2>Summary</h2>
<ul>
<li>Total plays: ${analytics?.totalPlays ?? 0}</li>
<li>Unique tracks: ${analytics?.uniqueTracks ?? 0}</li>
<li>Unique artists: ${analytics?.uniqueArtists ?? 0}</li>
<li>Unique genres: ${analytics?.uniqueGenres ?? 0}</li>
</ul>
<h2>Top Songs</h2>
<table><thead><tr><th>Title</th><th>Artist</th><th>Plays</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function RadioClockCard({
  years,
  data,
  empty,
}: {
  years: number[];
  data: Array<Record<string, number | string>>;
  empty: boolean;
}) {
  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-lg">Top years by hour (Radio clock)</h2>
        {empty || years.length === 0 ? (
          <p className="text-sm opacity-70">No hourly year data for this filter.</p>
        ) : (
          <div className="w-full h-[320px] min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data}>
                <PolarGrid />
                <PolarAngleAxis dataKey="hourLabel" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis />
                <Legend />
                {years.map((year, idx) => (
                  <Radar
                    key={year}
                    name={String(year)}
                    dataKey={`year_${year}`}
                    stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                    fill={CHART_COLORS[idx % CHART_COLORS.length]}
                    fillOpacity={0.2}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function ExclusiveSongsCard({
  data,
}: {
  data: AnalyticsResponse["exclusiveStationSongs"];
}) {
  const handleExportCsv = () => {
    const rows = [
      ["Station", "Title", "Artist", "Album", "Plays"],
      ...data.flatMap((bucket) =>
        bucket.songs.map((song) => [
          bucket.stationName,
          song.title,
          song.artist ?? "",
          song.album ?? "",
          String(song.count),
        ])
      ),
    ];
    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exclusive-songs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body">
        <div className="flex items-center justify-between gap-2">
          <h2 className="card-title text-lg">Exclusive songs (Diesi / Melodia / Menta)</h2>
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={handleExportCsv}
            disabled={data.length === 0}
          >
            Export CSV
          </button>
        </div>
        {data.length === 0 ? (
          <p className="text-sm opacity-70">
            No exclusive-song data found for the selected filter.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {data.map((bucket) => (
              <div key={bucket.stationName} className="rounded-lg border border-base-300 p-3">
                <h3 className="font-semibold mb-2">{bucket.stationName}</h3>
                {bucket.songs.length === 0 ? (
                  <p className="text-sm opacity-60">No exclusive songs.</p>
                ) : (
                  <div className="overflow-auto max-h-48">
                    <table className="table table-xs">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Artist</th>
                          <th className="text-right">Plays</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bucket.songs.slice(0, 10).map((song) => (
                          <tr key={`${bucket.stationName}-${song.title}-${song.artist ?? ""}`}>
                            <td>{song.title}</td>
                            <td>{song.artist ?? "-"}</td>
                            <td className="text-right">{song.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface BarChartDataPoint {
  name: string;
  count: number;
  title?: string;
  artist?: string | null;
  album?: string | null;
}

function BarChartCard({
  title,
  data,
  tooltipMode,
}: {
  title: string;
  data: BarChartDataPoint[];
  tooltipMode?: "song";
}) {
  const isSongTooltip = tooltipMode === "song";

  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-lg">{title}</h2>
        <div className="w-full h-[280px] min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis type="number" tick={{ fill: "currentColor" }} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11, fill: "currentColor" }}
                tickFormatter={(v) =>
                  v.length > 20 ? `${v.slice(0, 18)}…` : v
                }
              />
              <Tooltip
                content={
                  isSongTooltip
                    ? (props: {
                        active?: boolean;
                        payload?: ReadonlyArray<{
                          payload: BarChartDataPoint;
                          value?: number;
                        }>;
                      }) => (
                        <SongTooltipContent
                          active={props.active}
                          payload={
                            props.payload as
                              | Array<{
                                  payload: BarChartDataPoint;
                                  value?: number;
                                }>
                              | undefined
                          }
                        />
                      )
                    : undefined
                }
                contentStyle={
                  isSongTooltip
                    ? undefined
                    : {
                        backgroundColor: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                        color: "#0f172a",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                      }
                }
                formatter={
                  isSongTooltip
                    ? undefined
                    : (value: number | undefined) => [value ?? 0, "Plays"]
                }
                labelFormatter={
                  isSongTooltip
                    ? undefined
                    : (label) =>
                        typeof label === "string" && label.length > 40
                          ? `${label.slice(0, 38)}…`
                          : label
                }
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={32}>
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function SongTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: BarChartDataPoint; value?: number }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const plays = payload[0].value ?? 0;
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 px-3 py-2.5 shadow-lg text-base-content text-left max-w-xs">
      {p.title != null && p.title !== "" && (
        <p className="font-semibold">{p.title}</p>
      )}
      {p.artist != null && p.artist !== "" && (
        <p className="text-sm opacity-90">Artist: {p.artist}</p>
      )}
      {p.album != null && p.album !== "" && (
        <p className="text-sm opacity-90">Album: {p.album}</p>
      )}
      <p className="text-sm mt-1 font-medium">
        Plays: {plays.toLocaleString()}
      </p>
    </div>
  );
}
