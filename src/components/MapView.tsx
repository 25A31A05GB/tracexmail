import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Globe,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Layers,
  Compass,
  Copy,
  Check,
  Database,
  Navigation,
  Server,
  Radio,
  Eye,
  Info
} from 'lucide-react';
import { EmailAnalysis, EmailHop } from '../types';

interface MapViewProps {
  analysis: EmailAnalysis;
}

type MapTileStyle = 'DARK' | 'SATELLITE' | 'TOPO';

const TILE_LAYERS: Record<MapTileStyle, { url: string; attribution: string; maxZoom: number }> = {
  DARK: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>, &copy; OpenStreetMap contributors',
    maxZoom: 19
  },
  SATELLITE: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18
  },
  TOPO: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }
};

export function MapView({ analysis }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [tileStyle, setTileStyle] = useState<MapTileStyle>('DARK');
  const [showArcs, setShowArcs] = useState<boolean>(true);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [selectedHopIp, setSelectedHopIp] = useState<string | null>(null);

  if (!analysis) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#14120f] text-[#8a8070]">
        <Globe className="w-10 h-10 text-[#7fa3ba] mb-3" />
        <h3 className="text-base font-bold text-[#ede6d8]">No Analysis Selected</h3>
        <p className="text-xs text-[#8a8070] mt-1">Please select an analysis to view geographic routing.</p>
      </div>
    );
  }

  const hops = Array.isArray(analysis.hops) ? analysis.hops : [];
  const validHops = hops.filter(
    (h) => h?.lat !== undefined && h?.lng !== undefined && !(h?.lat === 0 && h?.lng === 0)
  );

  const handleCopyIp = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Cleanup existing map if present
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const initialCenter: [number, number] = validHops.length > 0 ? [validHops[0].lat!, validHops[0].lng!] : [20, 0];
    const initialZoom = validHops.length > 0 ? 3 : 2;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true,
    });

    mapInstanceRef.current = map;

    // Add selected Tile Layer
    const selectedTile = TILE_LAYERS[tileStyle];
    const tileLayer = L.tileLayer(selectedTile.url, {
      attribution: selectedTile.attribution,
      maxZoom: selectedTile.maxZoom,
      subdomains: 'abcd',
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    const latLngs: [number, number][] = [];

    // Render Markers with Glowing Radar Pulse Effect
    validHops.forEach((hop) => {
      const lat = hop.lat!;
      const lng = hop.lng!;
      latLngs.push([lat, lng]);

      const isOrigin = hop.isOrigin;
      const isHighRisk = hop.abuseScore && hop.abuseScore > 40;

      const markerColor = isOrigin ? '#F43F5E' : isHighRisk ? '#F59E0B' : '#3B82F6';
      const pulseColor = isOrigin ? 'rgba(244, 63, 94, 0.4)' : 'rgba(59, 130, 246, 0.4)';

      const markerHtml = `
        <div style="position: relative; width: 32px; height: 32px; display: flex; items-center; justify-content: center;">
          <div style="
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            background: ${pulseColor};
            animation: pulse-ring 2s infinite ease-out;
          "></div>
          <div style="
            position: relative;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: ${markerColor};
            border: 2px solid #FFFFFF;
            box-shadow: 0 0 14px ${markerColor};
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFFFFF;
            font-weight: bold;
            font-size: 11px;
            font-family: monospace;
          ">
            ${hop.hopNumber}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-leaflet-marker-animated',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const popupContent = `
        <div style="font-family: monospace, sans-serif; font-size: 12px; color: #0F172A; min-width: 240px; padding: 2px;">
          <div style="
            font-weight: bold;
            font-size: 13px;
            padding-bottom: 6px;
            margin-bottom: 6px;
            border-bottom: 1px solid #CBD5E1;
            color: ${isOrigin ? '#E11D48' : '#2563EB'};
            display: flex;
            align-items: center;
            justify-content: space-between;
          ">
            <span>${isOrigin ? '⚠️ ORIGINATING SENDER' : `RELAY HOP #${hop.hopNumber}`}</span>
            <span style="font-size: 10px; background: #E2E8F0; padding: 2px 6px; border-radius: 4px; color: #334155;">
              ${hop.countryCode || 'UN'}
            </span>
          </div>
          <div style="margin-bottom: 3px;"><strong>IP:</strong> <code style="color: #0284C7; font-weight: bold;">${hop.fromIp}</code></div>
          <div style="margin-bottom: 3px;"><strong>PTR DNS:</strong> <span style="font-size: 11px; color: #475569;">${hop.reverseDns || 'No PTR Record'}</span></div>
          <div style="margin-bottom: 3px;"><strong>Location:</strong> ${hop.city ? `${hop.city}, ` : ''}${hop.country || 'Unknown'}</div>
          <div style="margin-bottom: 3px;"><strong>Coordinates:</strong> ${lat.toFixed(4)}°, ${lng.toFixed(4)}°</div>
          <div style="margin-bottom: 3px;"><strong>Autonomous Sys:</strong> ${hop.asn || 'N/A'}</div>
          <div style="margin-bottom: 3px;"><strong>ISP / Org:</strong> ${hop.org || 'Unknown'}</div>
          <div style="margin-bottom: 3px;"><strong>MaxMind API DB:</strong> <span style="color: #0369A1; font-weight: bold;">${hop.lookupMethod || 'MaxMind GeoIP2 City Precision'}</span></div>
          ${
            hop.isTorExitNode || hop.is_tor
              ? `<div style="margin-top: 4px; padding: 4px 6px; background: #FFE4E6; color: #BE123C; border: 1px solid #FDA4AF; border-radius: 4px; font-weight: bold; font-size: 11px; display: flex; align-items: center; gap: 4px;">
                  <span>🧅</span> <span>CONFIRMED TOR EXIT NODE</span>
                </div>`
              : ''
          }
          ${
            hop.abuseScore !== undefined
              ? `<div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #E2E8F0; font-weight: bold; color: ${
                  hop.abuseScore > 40 ? '#E11D48' : '#059669'
                }; font-size: 11px;">
                  Abuse & Threat Rating: ${hop.abuseScore}/100 ${hop.isProxyOrVpn ? '(PROXY DETECTED)' : ''}
                </div>`
              : ''
          }
        </div>
      `;

      L.marker([lat, lng], { icon: customIcon })
        .addTo(map)
        .bindPopup(popupContent);
    });

    // Draw connecting path polyline between hops if enabled
    if (showArcs && latLngs.length > 1) {
      L.polyline(latLngs, {
        color: '#3B82F6',
        weight: 3,
        opacity: 0.85,
        dashArray: '8, 10',
      }).addTo(map);

      // Fit bounds with padding
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 6 });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [analysis, tileStyle, showArcs]);

  // Center on Origin Hop
  const handleCenterOrigin = () => {
    if (!mapInstanceRef.current) return;
    const originHop = validHops.find((h) => h.isOrigin) || validHops[0];
    if (originHop && originHop.lat !== undefined && originHop.lng !== undefined) {
      mapInstanceRef.current.flyTo([originHop.lat, originHop.lng], 6, {
        duration: 1.5
      });
    }
  };

  // Fit all markers
  const handleFitBounds = () => {
    if (!mapInstanceRef.current || validHops.length === 0) return;
    const latLngs: [number, number][] = validHops.map((h) => [h.lat!, h.lng!]);
    const bounds = L.latLngBounds(latLngs);
    mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 6 });
  };

  return (
    <div id="map-view-container" className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto bg-[#14120f]">
      {/* Map Header Card */}
      <div className="bg-[#1a1712] border border-[#3a352c] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                MaxMind GeoIP2 & Global Infrastructure Map
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                Precision Telemetry
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Real-time geographic visualization of email transmission relays, MaxMind database parameters, and ASN carrier paths.
            </p>
          </div>
        </div>

        {/* Map View Controls & Tile Theme Switcher */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto font-mono text-xs">
          {/* Tile Layer Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-700 p-1 rounded-lg">
            <button
              onClick={() => setTileStyle('DARK')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                tileStyle === 'DARK' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3 h-3 text-blue-300" />
              <span>Cyber Dark</span>
            </button>
            <button
              onClick={() => setTileStyle('SATELLITE')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                tileStyle === 'SATELLITE' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3 h-3 text-amber-300" />
              <span>Satellite</span>
            </button>
            <button
              onClick={() => setTileStyle('TOPO')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                tileStyle === 'TOPO' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3 h-3 text-emerald-300" />
              <span>Vector</span>
            </button>
          </div>

          {/* Action Buttons */}
          <button
            onClick={handleCenterOrigin}
            className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Fly map directly to originating sender location"
          >
            <Compass className="w-3.5 h-3.5 text-rose-400" />
            <span>Center Origin</span>
          </button>

          <button
            onClick={handleFitBounds}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Fit view bounds around all hop coordinates"
          >
            <Navigation className="w-3.5 h-3.5 text-slate-400" />
            <span>Fit All</span>
          </button>

          <button
            onClick={() => setShowArcs(!showArcs)}
            className={`px-2.5 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showArcs
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{showArcs ? 'Hide Trajectory' : 'Show Trajectory'}</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Map Stage */}
      <div className="bg-[#1a1712] border border-[#3a352c] rounded-xl overflow-hidden relative shadow-xl min-h-[520px] flex flex-col">
        <div ref={mapContainerRef} className="w-full h-[520px] z-10"></div>

        {validHops.length === 0 && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm p-6 text-center">
            <Globe className="w-12 h-12 text-slate-500 mb-3 animate-pulse" />
            <h4 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wide">
              No Public Geolocation Coordinates Resolved
            </h4>
            <p className="text-xs text-slate-400 max-w-md mt-1 font-mono">
              The extracted IP addresses in this message represent internal RFC 1918 private subnets (e.g. 10.0.0.0/8, 192.168.0.0/16) or unmapped relays.
            </p>
          </div>
        )}

        {/* Floating Trajectory Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-lg p-3.5 max-w-sm shadow-2xl text-xs space-y-2 font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              Trace Trajectory Summary
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">{validHops.length} Hops Geolocated</span>
          </div>

          <div className="space-y-1.5 max-h-32 overflow-y-auto text-[11px]">
            {analysis.hops.map((hop, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedHopIp(hop.fromIp || null)}
                className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                  selectedHopIp === hop.fromIp ? 'bg-blue-600/30 text-white' : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      hop.isOrigin ? 'bg-rose-500 shadow-sm shadow-rose-500' : 'bg-blue-500'
                    }`}
                  ></span>
                  <span className="font-bold text-slate-200">#{hop.hopNumber}</span>
                  <span className="text-slate-400 font-mono text-[10px]">{hop.fromIp}</span>
                </span>
                <span className="text-slate-400 text-[10px] font-bold shrink-0">
                  {hop.city ? `${hop.city}, ` : ''}{hop.countryCode || 'UN'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MaxMind GeoIP & Network Infrastructure Forensics Grid (100% Transparent Data) */}
      <div className="bg-[#1a1712] border border-[#3a352c] rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              MaxMind GeoIP2 & Network Infrastructure Telemetry
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Unfiltered MaxMind DB & WHOIS/RDAP API parameters for every transmission hop.
          </span>
        </div>

        {/* Detailed Hop Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analysis.hops.map((hop) => {
            const isOrigin = hop.isOrigin;
            const isAbuse = hop.abuseScore && hop.abuseScore > 40;

            return (
              <div
                key={hop.hopNumber}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 shadow-md transition-all ${
                  isOrigin
                    ? 'bg-rose-950/20 border-rose-500/50 shadow-rose-950/20'
                    : isAbuse
                    ? 'bg-amber-950/20 border-amber-500/50'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Hop Title Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                        isOrigin
                          ? 'bg-rose-600 text-white'
                          : isAbuse
                          ? 'bg-amber-600 text-white'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      #{hop.hopNumber}
                    </span>
                    <span className="text-xs font-bold text-slate-100 font-mono">
                      {isOrigin ? 'ORIGIN SENDER' : `RELAY HOP #${hop.hopNumber}`}
                    </span>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                    {hop.countryCode || 'GLOBAL'}
                  </span>
                </div>

                {/* Main MaxMind IP & DNS Info */}
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between bg-slate-950/70 p-2 rounded border border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">IPv4 / IPv6 Address:</span>
                      <span className="text-blue-400 font-bold font-mono text-sm">{hop.fromIp || '127.0.0.1'}</span>
                    </div>
                    <button
                      onClick={() => handleCopyIp(hop.fromIp || '')}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                      title="Copy IP"
                    >
                      {copiedIp === hop.fromIp ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-950/40 p-2 rounded border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase block">City & State:</span>
                      <span className="text-slate-200 font-bold truncate block" title={hop.city}>
                        {hop.city || 'Unknown'}
                      </span>
                    </div>
                    <div className="bg-slate-950/40 p-2 rounded border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase block">Country Name:</span>
                      <span className="text-slate-200 font-bold truncate block" title={hop.country}>
                        {hop.country || 'Unknown'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 p-2 rounded border border-slate-800/80 text-[11px]">
                    <span className="text-[10px] text-slate-400 uppercase block">Reverse PTR DNS:</span>
                    <span className="text-emerald-400 font-mono font-medium truncate block" title={hop.reverseDns}>
                      {hop.reverseDns || 'No PTR Record Configured'}
                    </span>
                  </div>

                  <div className="bg-slate-950/40 p-2 rounded border border-slate-800/80 text-[11px]">
                    <span className="text-[10px] text-slate-400 uppercase block">Autonomous System (ASN) & ISP:</span>
                    <span className="text-slate-200 font-bold truncate block" title={`${hop.asn} - ${hop.org}`}>
                      {hop.asn ? `${hop.asn} — ${hop.org || 'Unknown'}` : 'Unknown ASN'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-950/40 p-2 rounded border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase block">Coordinates:</span>
                      <span className="text-slate-300 font-mono block">
                        {hop.lat !== undefined ? `${hop.lat.toFixed(2)}°, ${hop.lng?.toFixed(2)}°` : 'Unresolved'}
                      </span>
                    </div>
                    <div className="bg-slate-950/40 p-2 rounded border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase block">MaxMind DB API:</span>
                      <span className="text-blue-300 font-mono block truncate" title={hop.lookupMethod}>
                        {hop.lookupMethod || 'MaxMind GeoLite2'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Threat & Proxy Footer Pill */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className={`w-3.5 h-3.5 ${isAbuse ? 'text-rose-400' : 'text-emerald-400'}`} />
                    <span className="text-slate-400">Threat Rating:</span>
                    <span className={`font-bold ${isAbuse ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {hop.abuseScore ? `${hop.abuseScore}/100` : 'Clean'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(hop.isTorExitNode || hop.is_tor) && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                        🧅 TOR EXIT NODE
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        hop.isProxyOrVpn
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {hop.isProxyOrVpn ? 'PROXY / VPN' : 'DIRECT NET'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
