import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  CircleAlert,
  Disc3,
  FileBarChart,
  Heart,
  Home,
  Menu,
  Music2,
  PanelRightClose,
  PanelRightOpen,
  Radio,
  Search,
  Settings,
  Sparkles,
  Users,
  Waves,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import logo from "../assets/logo.png";
import { fetchStations, type StationResponse } from "../data/api";
import { useAudioPlayer } from "./AudioPlayerContext";

type NavigationItem = {
  label: string;
  to: "/" | "/tracks" | "/favorites" | "/analytics";
  icon: typeof Home;
  match?: "exact" | "prefix";
  routeActive?: boolean;
};

const primaryNavigation: NavigationItem[] = [
  { label: "Dashboard", to: "/", icon: Home, match: "exact", routeActive: true },
  { label: "Live Monitor", to: "/", icon: Activity, match: "exact", routeActive: false },
  { label: "Stations", to: "/", icon: Radio, match: "exact", routeActive: false },
  { label: "Airplays", to: "/tracks", icon: Disc3, routeActive: true },
  { label: "Songs", to: "/tracks", icon: Music2, routeActive: false },
  { label: "Analytics", to: "/analytics", icon: BarChart3, routeActive: true },
  { label: "VOYAGER", to: "/analytics", icon: Sparkles, routeActive: false },
  { label: "Alerts", to: "/analytics", icon: CircleAlert, routeActive: false },
];

const secondaryNavigation: NavigationItem[] = [
  { label: "Saved", to: "/favorites", icon: Heart },
  { label: "Reports", to: "/analytics", icon: FileBarChart, routeActive: false },
  { label: "Users", to: "/analytics", icon: Users, routeActive: false },
  { label: "Settings", to: "/analytics", icon: Settings, routeActive: false },
];

function stationForPlayback(
  stations: StationResponse[] | undefined,
  playingId: string | null,
): StationResponse | undefined {
  if (!stations?.length) return undefined;
  const id = Number(playingId?.replace("station-", ""));
  return stations.find((station) => station.id === id) ?? stations.find((station) => station.enabled) ?? stations[0];
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { playingId, toggle } = useAudioPlayer();
  const [collapsed, setCollapsed] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: stationsData } = useQuery({
    queryKey: ["stations"],
    queryFn: fetchStations,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    setCollapsed(
      window.innerWidth <= 860 ||
        window.localStorage.getItem("marconi-sidebar-collapsed") === "true",
    );
    setContextOpen(window.innerWidth > 1279);
  }, []);

  const setSidebarCollapsed = (next: boolean) => {
    setCollapsed(next);
    window.localStorage.setItem("marconi-sidebar-collapsed", String(next));
  };

  const selectedStation = useMemo(
    () => stationForPlayback(stationsData?.stations, playingId),
    [stationsData?.stations, playingId],
  );
  const onlineCount = stationsData?.stations.filter((station) => station.enabled).length ?? 0;

  return (
    <div className={`marconi-app ${collapsed ? "is-sidebar-collapsed" : ""} ${contextOpen ? "is-context-open" : ""}`}>
      <header className="marconi-topbar">
        <div className="marconi-topbar-brand">
          <button
            type="button"
            className="marconi-icon-button marconi-mobile-menu"
            aria-label="Άνοιγμα πλοήγησης"
            onClick={() => setSidebarCollapsed(false)}
          >
            <Menu size={19} />
          </button>
          <Link to="/" className="marconi-brand" aria-label="Marconi SoundIntel dashboard">
            <img src={logo} alt="" className="marconi-brand-mark" />
            <span><strong>Marconi</strong> SoundIntel</span>
          </Link>
          <div className="marconi-history-buttons">
            <button type="button" className="marconi-icon-button" aria-label="Πίσω" onClick={() => window.history.back()}><ChevronLeft size={18} /></button>
            <button type="button" className="marconi-icon-button" aria-label="Μπροστά" onClick={() => window.history.forward()}><ChevronRight size={18} /></button>
          </div>
        </div>

        <label className="marconi-global-search">
          <Search size={17} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Αναζήτηση σταθμού, τραγουδιού, καλλιτέχνη ή Airplay"
            aria-label="Αναζήτηση"
          />
        </label>

        <div className="marconi-topbar-actions">
          <span className="marconi-system-status"><i /> Σύστημα online</span>
          <button type="button" className="marconi-icon-button" aria-label="Ειδοποιήσεις"><Bell size={18} /></button>
          <button type="button" className="marconi-profile" aria-label="Λογαριασμός χρήστη">
            <span>MA</span>
            <b>Admin</b>
          </button>
          <button
            type="button"
            className="marconi-icon-button"
            aria-label={contextOpen ? "Κλείσιμο panel παρακολούθησης" : "Άνοιγμα panel παρακολούθησης"}
            onClick={() => setContextOpen((open) => !open)}
          >
            {contextOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </div>
      </header>

      <aside className="marconi-sidebar" aria-label="Κύρια πλοήγηση">
        <button
          type="button"
          className="marconi-collapse-button"
          aria-label={collapsed ? "Άνοιγμα sidebar" : "Σύμπτυξη sidebar"}
          onClick={() => setSidebarCollapsed(!collapsed)}
        >
          {collapsed ? <Menu size={18} /> : <ChevronsLeft size={18} />}
        </button>
        <nav className="marconi-nav-list">
          <NavigationGroup items={primaryNavigation} pathname={pathname} />
          <div className="marconi-nav-divider" />
          <NavigationGroup items={secondaryNavigation} pathname={pathname} />
        </nav>
        <div className="marconi-sidebar-footer">
          <span className="marconi-live-dot" />
          <div>
            <strong>{onlineCount} Streams online</strong>
            <small>System operational</small>
          </div>
          <em>v1.0</em>
        </div>
      </aside>

      <main className="marconi-main-content">{children}</main>

      <aside className="marconi-context-panel" aria-label="Now Monitoring">
        <ContextPanel station={selectedStation} isPlaying={playingId === `station-${selectedStation?.id}`} onPlay={() => {
          if (!selectedStation) return;
          toggle(`station-${selectedStation.id}`, selectedStation.url, {
            stationName: selectedStation.name,
            title: selectedStation.currentTrack?.title,
            artist: selectedStation.currentTrack?.artist,
            album: selectedStation.currentTrack?.album,
            coverUrl: selectedStation.currentTrack?.coverUrl,
          });
        }} />
      </aside>

      <nav className="marconi-mobile-nav" aria-label="Πλοήγηση κινητού">
        <Link to="/" aria-label="Dashboard"><Home size={18} /><span>Home</span></Link>
        <Link to="/" aria-label="Live Monitor"><Waves size={18} /><span>Live</span></Link>
        <Link to="/tracks" aria-label="Airplays"><Disc3 size={18} /><span>Airplays</span></Link>
        <button type="button" aria-label="Αναζήτηση" onClick={() => document.querySelector<HTMLInputElement>(".marconi-global-search input")?.focus()}><Search size={18} /><span>Search</span></button>
        <button type="button" aria-label="Περισσότερα" onClick={() => setSidebarCollapsed(false)}><Menu size={18} /><span>More</span></button>
      </nav>
    </div>
  );
}

function NavigationGroup({ items, pathname }: { items: NavigationItem[]; pathname: string }) {
  return (
    <>
      {items.map((item) => {
        const exact = item.match === "exact";
        const routeMatches = exact ? pathname === item.to : pathname.startsWith(item.to);
        const active = item.routeActive == null ? routeMatches : item.routeActive && routeMatches;
        const Icon = item.icon;
        return (
          <Link
            key={`${item.label}-${item.to}`}
            to={item.to}
            className={`marconi-nav-item ${active ? "is-active" : ""}`}
            title={item.label}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

function ContextPanel({ station, isPlaying, onPlay }: { station?: StationResponse; isPlaying: boolean; onPlay: () => void }) {
  const track = station?.currentTrack;
  const confidence = track?.confidenceScore == null ? "-" : `${Math.round(track.confidenceScore)}%`;
  return (
    <div className="marconi-context-inner">
      <div className="marconi-context-heading">
        <div>
          <p>LIVE INTELLIGENCE</p>
          <h2>Now Monitoring</h2>
        </div>
        <span className="marconi-live-badge"><i /> LIVE</span>
      </div>

      {station ? (
        <>
          <div className="marconi-monitor-artwork">
            {track?.coverUrl ? <img src={track.coverUrl} alt="" /> : station.logoUrl ? <img className="marconi-logo-art" src={station.logoUrl} alt="" /> : <Music2 size={48} />}
            <button type="button" className="marconi-round-play" aria-label={isPlaying ? "Παύση stream" : "Ακρόαση stream"} onClick={onPlay}>
              {isPlaying ? <Waves size={20} /> : <Radio size={20} />}
            </button>
          </div>
          <section className="marconi-now-track">
            <div className="marconi-station-line">
              {station.logoUrl && <img src={station.logoUrl} alt="" />}
              <span>{station.name}</span>
              <b>ONLINE</b>
            </div>
            <h3>{track?.title || "Δεν υπάρχει αναγνώριση αυτή τη στιγμή"}</h3>
            <p>{track?.artist || "Περιμένει νέο audio fingerprint"}</p>
            <dl>
              <div><dt>Album</dt><dd>{track?.album || "-"}</dd></div>
              <div><dt>Confidence</dt><dd className="is-good">{confidence}</dd></div>
              <div><dt>Source</dt><dd>{track?.shazamUrl ? "Shazam" : "Stream monitor"}</dd></div>
              <div><dt>Audio</dt><dd>{station.errorMessage ? "Needs attention" : "Connected"}</dd></div>
            </dl>
          </section>
          <div className="marconi-context-actions">
            <Link to="/tracks" search={{ stationIds: String(station.id) }}>Ιστορικό Airplays</Link>
            <Link to="/analytics">Δημιουργία alert</Link>
          </div>
        </>
      ) : (
        <div className="marconi-context-empty"><Radio size={28} /><strong>Δεν βρέθηκαν σταθμοί</strong><span>Πρόσθεσε ή ενεργοποίησε έναν σταθμό για παρακολούθηση.</span></div>
      )}

      <section className="marconi-voyager-card">
        <div><Sparkles size={16} /><span>VOYAGER Prediction</span></div>
        <strong>{track ? "Μαθαίνει το clock του σταθμού" : "Περιμένει ιστορικό airplays"}</strong>
        <p>Η επιβεβαιωμένη πρόβλεψη θα εμφανιστεί εδώ όταν υπάρχει επαρκές ιστορικό.</p>
      </section>
    </div>
  );
}
