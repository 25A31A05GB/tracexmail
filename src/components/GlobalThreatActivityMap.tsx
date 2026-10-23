import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Globe, 
  ShieldAlert, 
  Activity, 
  MapPin, 
  Radio, 
  Eye, 
  Layers, 
  Compass, 
  Navigation, 
  RefreshCw, 
  Play, 
  Pause, 
  Zap, 
  Filter, 
  Crosshair,
  Server,
  ArrowRight
} from 'lucide-react';

export interface GlobalThreatActivityPoint {
  id: string;
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lng: number;
  threatType: 'BEC_WIRE_FRAUD' | 'PHISHING_CREDENTIALS' | 'MALWARE_ATTACHMENT' | 'QUISHING_QR' | 'SPOOFED_HEADER';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  targetUser: string;
  targetOrg: string;
  asn: string;
  isp: string;
  timestamp: string;
}

const INITIAL_THREAT_POINTS: GlobalThreatActivityPoint[] = [
  {
    id: 'threat_001',
    ip: '185.220.101.5',
    country: 'Russia',
    countryCode: 'RU',
    city: 'Moscow',
    lat: 55.7558,
    lng: 37.6173,
    threatType: 'BEC_WIRE_FRAUD',
    severity: 'CRITICAL',
    targetUser: 'finance-lead@aegisfinancial.com',
    targetOrg: 'Aegis Financial Global',
    asn: 'AS208323',
    isp: 'M247 Europe Cyber Net',
    timestamp: 'Just now'
  },
  {
    id: 'threat_002',
    ip: '103.251.167.22',
    country: 'China',
    countryCode: 'CN',
    city: 'Shenzhen',
    lat: 22.5431,
    lng: 114.0579,
    threatType: 'PHISHING_CREDENTIALS',
    severity: 'HIGH',
    targetUser: 'executive@enterprise.corp',
    targetOrg: 'Acme Cyber Defense SOC',
    asn: 'AS4134',
    isp: 'CHINANET Guangdong Telecom',
    timestamp: '12 sec ago'
  },
  {
    id: 'threat_003',
    ip: '197.210.64.12',
    country: 'Nigeria',
    countryCode: 'NG',
    city: 'Lagos',
    lat: 6.5244,
    lng: 3.3792,
    threatType: 'QUISHING_QR',
    severity: 'CRITICAL',
    targetUser: 'ciso@sovereignbank.com',
    targetOrg: 'Sovereign Bank Group',
    asn: 'AS29465',
    isp: 'MTN Nigeria Cyber Relay',
    timestamp: '28 sec ago'
  },
  {
    id: 'threat_004',
    ip: '89.238.176.44',
    country: 'Romania',
    countryCode: 'RO',
    city: 'Bucharest',
    lat: 44.4323,
    lng: 26.1063,
    threatType: 'MALWARE_ATTACHMENT',
    severity: 'HIGH',
    targetUser: 'payroll@globalhealth.org',
    targetOrg: 'Sovereign Health Systems',
    asn: 'AS9009',
    isp: 'M247 Romania Gateway',
    timestamp: '45 sec ago'
  },
  {
    id: 'threat_005',
    ip: '177.12.89.102',
    country: 'Brazil',
    countryCode: 'BR',
    city: 'São Paulo',
    lat: -23.5505,
    lng: -46.6333,
    threatType: 'SPOOFED_HEADER',
    severity: 'MEDIUM',
    targetUser: 'billing@nordicenergy.se',
    targetOrg: 'Nordic Energy Cyber Defence',
    asn: 'AS28573',
    isp: 'Claro Brasil Fiber',
    timestamp: '1 min ago'
  },
  {
    id: 'threat_006',
    ip: '118.27.32.18',
    country: 'Japan',
    countryCode: 'JP',
    city: 'Tokyo',
    lat: 35.6762,
    lng: 139.6503,
    threatType: 'PHISHING_CREDENTIALS',
    severity: 'HIGH',
    targetUser: 'ops@kurodatech.jp',
    targetOrg: 'Kuroda Tech Labs',
    asn: 'AS2514',
    isp: 'NTT Communications',
    timestamp: '2 min ago'
  },
  {
    id: 'threat_007',
    ip: '185.107.56.201',
    country: 'Netherlands',
    countryCode: 'NL',
    city: 'Amsterdam',
    lat: 52.3676,
    lng: 4.9041,
    threatType: 'BEC_WIRE_FRAUD',
    severity: 'CRITICAL',
    targetUser: 'treasury@titanlogistics.de',
    targetOrg: 'Titan Aerospace Defense',
    asn: 'AS60781',
    isp: 'Leaseweb Netherlands B.V.',
    timestamp: '3 min ago'
  }
];

// Target Ingestion Nodes
const GATEWAY_NODES = [
  { name: 'US-East Gateway', lat: 38.9072, lng: -77.0369 },
  { name: 'EU-Central Gateway', lat: 50.1109, lng: 8.6821 },
  { name: 'AP-East Gateway', lat: 1.3521, lng: 103.8198 }
];

type MapTileStyle = 'DARK' | 'SATELLITE' | 'VECTOR';

const TILE_LAYERS: Record<MapTileStyle, { url: string; attribution: string }> = {
  DARK: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
  },
  SATELLITE: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri Satellite'
  },
  VECTOR: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap'
  }
};

export function GlobalThreatActivityMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const [threatPoints, setThreatPoints] = useState<GlobalThreatActivityPoint[]>(INITIAL_THREAT_POINTS);
  const [selectedSeverity, setSelectedSeverity] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [tileStyle, setTileStyle] = useState<MapTileStyle>('DARK');
  const [isLiveStreamActive, setIsLiveStreamActive] = useState<boolean>(true);
  const [activeThreat, setActiveThreat] = useState<GlobalThreatActivityPoint | null>(null);

  // Filter threat points by severity
  const filteredPoints = threatPoints.filter(p => selectedSeverity === 'ALL' || p.severity === selectedSeverity);

  // Live Threat Simulation Ticker
  useEffect(() => {
    if (!isLiveStreamActive) return;

    const interval = setInterval(() => {
      const sampleCities = [
        { name: 'Saint Petersburg', country: 'Russia', code: 'RU', lat: 59.9343, lng: 30.3351 },
        { name: 'Ho Chi Minh City', country: 'Vietnam', code: 'VN', lat: 10.8231, lng: 106.6297 },
        { name: 'Kiev', country: 'Ukraine', code: 'UA', lat: 50.4501, lng: 30.5234 },
        { name: 'Sofia', country: 'Bulgaria', code: 'BG', lat: 42.6977, lng: 23.3219 },
        { name: 'Jakarta', country: 'Indonesia', code: 'ID', lat: -6.2088, lng: 106.8456 },
        { name: 'Tehran', country: 'Iran', code: 'IR', lat: 35.6892, lng: 51.3890 }
      ];

      const threatTypes: GlobalThreatActivityPoint['threatType'][] = [
        'BEC_WIRE_FRAUD', 'PHISHING_CREDENTIALS', 'QUISHING_QR', 'MALWARE_ATTACHMENT', 'SPOOFED_HEADER'
      ];
      const severities: GlobalThreatActivityPoint['severity'][] = ['CRITICAL', 'HIGH', 'MEDIUM'];

      const randomCity = sampleCities[Math.floor(Math.random() * sampleCities.length)];
      const randomThreat = threatTypes[Math.floor(Math.random() * threatTypes.length)];
      const randomSev = severities[Math.floor(Math.random() * severities.length)];
      const randomIp = `${Math.floor(Math.random() * 180) + 20}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

      const newPoint: GlobalThreatActivityPoint = {
        id: `threat_live_${Date.now()}`,
        ip: randomIp,
        country: randomCity.country,
        countryCode: randomCity.code,
        city: randomCity.name,
        lat: randomCity.lat + (Math.random() - 0.5) * 0.2,
        lng: randomCity.lng + (Math.random() - 0.5) * 0.2,
        threatType: randomThreat,
        severity: randomSev,
        targetUser: `security-op_${Math.floor(Math.random() * 80) + 10}@enterprise.corp`,
        targetOrg: 'TraceXMail Global Enterprise',
        asn: `AS${Math.floor(Math.random() * 50000) + 10000}`,
        isp: `${randomCity.country} International Gateway`,
        timestamp: 'Just now'
      };

      setThreatPoints(prev => [newPoint, ...prev.slice(0, 14)]);
    }, 6000);

    return () => clearInterval(interval);
  }, [isLiveStreamActive]);

  // Leaflet Map Initialization & Re-render
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [20, 10],
      zoom: 2,
      zoomControl: true,
      maxZoom: 18,
      minZoom: 2
    });

    mapInstanceRef.current = map;

    const selectedTile = TILE_LAYERS[tileStyle];
    L.tileLayer(selectedTile.url, {
      attribution: selectedTile.attribution,
      maxZoom: 18,
      subdomains: 'abcd'
    }).addTo(map);

    // Plot Ingestion Gateway Nodes (Target Green Radar Nodes)
    GATEWAY_NODES.forEach((gw) => {
      const iconHtml = `
        <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; inset: -4px; border-radius: 50%; background: rgba(16, 185, 129, 0.4); animation: pulse 1.8s infinite;"></div>
          <div style="position: relative; width: 16px; height: 16px; border-radius: 50%; background: #10B981; border: 2px solid #FFFFFF; box-shadow: 0 0 10px #10B981;"></div>
        </div>
      `;
      const icon = L.divIcon({ html: iconHtml, className: 'gw-node-icon', iconSize: [24, 24], iconAnchor: [12, 12] });
      L.marker([gw.lat, gw.lng], { icon })
        .addTo(map)
        .bindPopup(`<div style="font-family: monospace; font-size: 11px; padding: 2px;"><strong>SOC Ingestion Node:</strong> ${gw.name}</div>`);
    });

    // Plot Filtered Threat Points
    filteredPoints.forEach((pt) => {
      const isCritical = pt.severity === 'CRITICAL';
      const isHigh = pt.severity === 'HIGH';

      const color = isCritical ? '#EF4444' : isHigh ? '#F59E0B' : '#3B82F6';
      const pulseBg = isCritical ? 'rgba(239, 68, 68, 0.5)' : isHigh ? 'rgba(245, 158, 11, 0.4)' : 'rgba(59, 130, 246, 0.4)';

      const markerHtml = `
        <div style="position: relative; width: 28px; height: 28px; display: flex; items-center; justify-content: center; cursor: pointer;">
          <div style="
            position: absolute;
            inset: -6px;
            border-radius: 50%;
            background: ${pulseBg};
            animation: pulse 2s infinite ease-out;
          "></div>
          <div style="
            position: relative;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: ${color};
            border: 2px solid #FFFFFF;
            box-shadow: 0 0 12px ${color};
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFFFFF;
            font-weight: bold;
            font-size: 10px;
            font-family: monospace;
          ">
            !
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'threat-activity-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const popupHtml = `
        <div style="font-family: monospace, sans-serif; font-size: 12px; color: #0F172A; min-width: 240px; padding: 4px;">
          <div style="
            font-weight: bold;
            font-size: 12px;
            padding-bottom: 6px;
            margin-bottom: 6px;
            border-bottom: 1px solid #CBD5E1;
            color: ${color};
            display: flex;
            align-items: center;
            justify-content: space-between;
          ">
            <span>🚨 ${pt.severity} THREAT</span>
            <span style="font-size: 10px; background: #E2E8F0; padding: 2px 6px; border-radius: 4px; color: #334155;">
              ${pt.countryCode}
            </span>
          </div>
          <div style="margin-bottom: 3px;"><strong>Origin IP:</strong> <code style="color: #0284C7; font-weight: bold;">${pt.ip}</code></div>
          <div style="margin-bottom: 3px;"><strong>Vector:</strong> <span style="color: ${color}; font-weight: bold;">${pt.threatType.replace(/_/g, ' ')}</span></div>
          <div style="margin-bottom: 3px;"><strong>Location:</strong> ${pt.city}, ${pt.country}</div>
          <div style="margin-bottom: 3px;"><strong>Target User:</strong> <span style="font-size: 11px; color: #334155;">${pt.targetUser}</span></div>
          <div style="margin-bottom: 3px;"><strong>ASN / ISP:</strong> ${pt.asn} (${pt.isp})</div>
          <div style="margin-bottom: 3px; font-size: 10px; color: #64748B;"><strong>Time:</strong> ${pt.timestamp}</div>
        </div>
      `;

      const marker = L.marker([pt.lat, pt.lng], { icon: customIcon })
        .addTo(map)
        .bindPopup(popupHtml);

      marker.on('click', () => {
        setActiveThreat(pt);
      });

      // Connect origin to nearest SOC Ingestion Node via arc line
      const nearestGw = GATEWAY_NODES[0];
      L.polyline([[pt.lat, pt.lng], [nearestGw.lat, nearestGw.lng]], {
        color,
        weight: 1.5,
        opacity: 0.6,
        dashArray: '4, 8'
      }).addTo(map);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [filteredPoints, tileStyle]);

  const handleCenterHighestThreat = () => {
    if (!mapInstanceRef.current || filteredPoints.length === 0) return;
    const highest = filteredPoints.find(p => p.severity === 'CRITICAL') || filteredPoints[0];
    mapInstanceRef.current.flyTo([highest.lat, highest.lng], 5, { duration: 1.5 });
    setActiveThreat(highest);
  };

  const handleFitAll = () => {
    if (!mapInstanceRef.current || filteredPoints.length === 0) return;
    const bounds = L.latLngBounds(filteredPoints.map(p => [p.lat, p.lng]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 5 });
  };

  return (
    <div className="bg-[var(--ink-2)] border border-[var(--line)] rounded-xl p-5 space-y-5 shadow-2xl">
      
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-amber-400" />
            <h2 className="font-display font-bold text-lg text-[var(--paper)] flex items-center gap-2">
              <span>Real-Time Global Threat Activity Map</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono text-[10px] font-bold uppercase flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping inline-block" />
              Live Processed Attacks
            </span>
          </div>
          <p className="text-xs text-[var(--paper-dim)]">
            Geographic origins of incoming malicious email payloads and phishing vectors actively intercepted by TraceXMail gateways.
          </p>
        </div>

        {/* Filter Controls & Map Actions */}
        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs w-full lg:w-auto">
          {/* Severity Filter */}
          <div className="flex items-center bg-[var(--ink)] p-1 rounded-lg border border-[var(--line)]">
            <span className="text-[10.5px] text-[var(--paper-dim)] px-2">Severity:</span>
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map(sev => (
              <button
                key={sev}
                onClick={() => setSelectedSeverity(sev)}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  selectedSeverity === sev
                    ? 'bg-amber-500 text-stone-950 font-bold'
                    : 'text-[var(--paper-dim)] hover:text-[var(--paper)]'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Tile Layer Selector */}
          <div className="flex items-center bg-[var(--ink)] p-1 rounded-lg border border-[var(--line)]">
            <button
              onClick={() => setTileStyle('DARK')}
              className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                tileStyle === 'DARK' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-[var(--paper-dim)]'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setTileStyle('SATELLITE')}
              className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                tileStyle === 'SATELLITE' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-[var(--paper-dim)]'
              }`}
            >
              Satellite
            </button>
          </div>

          {/* Pause / Live Toggle */}
          <button
            onClick={() => setIsLiveStreamActive(!isLiveStreamActive)}
            className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isLiveStreamActive
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-stone-800 border-stone-600 text-stone-300'
            }`}
          >
            {isLiveStreamActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isLiveStreamActive ? 'Live Stream' : 'Stream Paused'}</span>
          </button>

          {/* Center Highest Threat */}
          <button
            onClick={handleCenterHighestThreat}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Crosshair className="w-3.5 h-3.5 text-rose-400" />
            <span>Highest Threat</span>
          </button>
        </div>
      </div>

      {/* Main Map Stage Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        
        {/* Leaflet Map Stage (3 Cols) */}
        <div className="lg:col-span-3 bg-[#12100d] border border-[var(--line)] rounded-xl overflow-hidden relative shadow-xl min-h-[460px] flex flex-col">
          <div ref={mapContainerRef} className="w-full h-[460px] z-10"></div>

          {/* Map Footer Overlay Stats */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-stone-950/90 backdrop-blur border border-stone-800 rounded-lg p-3 text-xs font-mono space-y-1 text-stone-300 shadow-xl max-w-xs">
            <div className="flex items-center justify-between font-bold text-amber-300 border-b border-stone-800 pb-1">
              <span>ACTIVE ATTACK SOURCES</span>
              <span className="text-emerald-400">{filteredPoints.length} Live Origins</span>
            </div>
            <div className="text-[10.5px] text-stone-400 pt-0.5">
              Targeting: <span className="text-amber-200">TraceXMail Global SOC Gateways</span>
            </div>
          </div>
        </div>

        {/* Live Attack Ticker & Inspector Drawer (1 Col) */}
        <div className="bg-[var(--ink)] border border-[var(--line)] rounded-xl p-4 flex flex-col justify-between space-y-3 font-mono text-xs min-h-[460px]">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2 mb-3">
              <span className="font-bold text-amber-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>Threat Feed Stream</span>
              </span>
              <span className="text-[10px] text-stone-400">{filteredPoints.length} Events</span>
            </div>

            {/* List of Incoming Threat Points */}
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {filteredPoints.map((pt) => {
                const isSelected = activeThreat?.id === pt.id;
                const isCritical = pt.severity === 'CRITICAL';

                return (
                  <div
                    key={pt.id}
                    onClick={() => {
                      setActiveThreat(pt);
                      if (mapInstanceRef.current) {
                        mapInstanceRef.current.flyTo([pt.lat, pt.lng], 6, { duration: 1.2 });
                      }
                    }}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md'
                        : isCritical
                        ? 'bg-rose-950/30 border-rose-600/40 text-stone-200 hover:border-rose-400'
                        : 'bg-stone-900/80 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[11px] mb-1">
                      <span className="flex items-center gap-1.5 text-stone-100">
                        <span className={`w-2 h-2 rounded-full ${isCritical ? 'bg-rose-500 shadow-xs shadow-rose-500' : 'bg-amber-400'}`} />
                        <span className="truncate max-w-[110px]">{pt.city}, {pt.countryCode}</span>
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[9.5px] uppercase ${
                        isCritical ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50' : 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                      }`}>
                        {pt.severity}
                      </span>
                    </div>

                    <div className="text-[10.5px] text-amber-300/90 truncate font-semibold">
                      {pt.threatType.replace(/_/g, ' ')}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1">
                      <code>{pt.ip}</code>
                      <span>{pt.timestamp}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Inspector Footer Summary */}
          {activeThreat && (
            <div className="p-3 bg-stone-950 border border-amber-500/40 rounded-lg space-y-1.5 text-[11px] font-mono">
              <div className="text-amber-300 font-bold flex items-center justify-between border-b border-stone-800 pb-1">
                <span>Selected Threat Detail</span>
                <span className="text-[10px] text-stone-400">{activeThreat.countryCode}</span>
              </div>
              <div className="text-stone-300">Target: <code className="text-amber-200">{activeThreat.targetUser}</code></div>
              <div className="text-stone-400 text-[10px]">ISP: {activeThreat.isp} ({activeThreat.asn})</div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
