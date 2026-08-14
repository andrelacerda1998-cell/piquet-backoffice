"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { VendorLiveLocation } from "@/services/vendorsService";

// Ícones default do Leaflet apontam para caminhos relativos que o bundler do
// Next.js não resolve — usar os do CDN em vez de tentar importar os assets.
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Contas de teste: um pin visualmente distinto (laranja, tracejado) em vez de
// tentar arranjar outro PNG — para nunca se confundir com um técnico real.
const testMarkerIcon = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#f59e0b;border:2px dashed #92400e;box-shadow:0 0 0 2px white;"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -9],
});

// Centro por omissão: Lisboa — usado quando ainda não há nenhum técnico
// online para calcular os limites do mapa.
const DEFAULT_CENTER: [number, number] = [38.7223, -9.1393];

function minutesAgo(iso: string | null): string {
  if (!iso) return "sem hora";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.round(diffMs / 60000));
  if (min === 0) return "agora mesmo";
  if (min === 1) return "há 1 min";
  return `há ${min} min`;
}

export function TechnicianMap({ locations }: { locations: VendorLiveLocation[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  // Cria o mapa uma única vez.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Atualiza os marcadores sempre que a lista de localizações muda, sem
  // recriar o mapa (evita o "salto" visual a cada refresh).
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const withCoords = locations.filter(
      (t): t is VendorLiveLocation & { latitude: number; longitude: number } =>
        t.latitude !== null && t.longitude !== null
    );

    for (const t of withCoords) {
      const testTag = t.is_test ? ' <span style="color:#92400e;font-weight:600;">(conta de teste)</span>' : "";
      L.marker([t.latitude, t.longitude], { icon: t.is_test ? testMarkerIcon : markerIcon })
        .bindPopup(
          `<b>${t.name ?? "Técnico"}</b>${testTag}<br/>${t.categories.join(", ") || "sem categoria"}<br/><span style="color:#888">${minutesAgo(t.updated_at)}</span>`
        )
        .addTo(layer);
    }

    if (withCoords.length > 0) {
      const bounds = L.latLngBounds(withCoords.map((t) => [t.latitude, t.longitude] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [locations]);

  return <div ref={containerRef} className="h-[520px] w-full rounded-xl" />;
}
