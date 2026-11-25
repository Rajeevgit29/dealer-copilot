"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import { riskColor, type DistrictStat } from "./dashboard";

export function DistrictMap({ districts }: { districts: DistrictStat[] }) {
  const maxFields = Math.max(...districts.map((d) => d.fields), 1);
  return (
    <MapContainer
      bounds={districts.map((d) => [d.lat, d.lon] as [number, number])}
      boundsOptions={{ padding: [36, 36] }}
      zoomSnap={0.25}
      minZoom={4}
      maxZoom={9}
      scrollWheelZoom={false}
      className="h-full w-full"
      attributionControl
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
        maxNativeZoom={16}
      />
      {districts.map((d) => (
        <CircleMarker
          key={d.id}
          center={[d.lat, d.lon]}
          radius={7 + 13 * Math.sqrt(d.fields / maxFields)}
          pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: riskColor(d.beforeRate), fillOpacity: 0.85 }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            <div className="text-[12.5px]">
              <div className="font-semibold">
                {d.name}, {d.state}
              </div>
              <div className="text-[#45423c]">
                {d.beforeRate != null ? `${Math.round(d.beforeRate * 100)}% repeats before rollout` : "No early-season data"} · {d.afterRate != null ? `${Math.round(d.afterRate * 100)}% since` : ""} · {d.fields} fields
              </div>
              {d.topGroup ? (
                <div className="text-[#75716a]">
                  Most sprayed: group {d.topGroup.short} ({d.topGroup.name})
                </div>
              ) : null}
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
