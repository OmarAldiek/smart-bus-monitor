import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";

const DUBAI_CENTER = [25.2048, 55.2708];

const MapView = ({ buses, selectedBusId, onSelectBus }) => {
  return (
    <div className="h-80 w-full rounded-2xl border border-slate-200 overflow-hidden">
      <MapContainer
        center={DUBAI_CENTER}
        zoom={12}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {buses.map((bus) => (
          <CircleMarker
            key={bus.busId}
            center={[bus.lat, bus.lon]}
            radius={8}
            pathOptions={{
              color: bus.speed_kmh > 70 ? "#e55039" : "#38ada9",
              fillColor: bus.speed_kmh > 70 ? "#e55039" : "#38ada9",
              fillOpacity: bus.busId === selectedBusId ? 1 : 0.85,
              weight: bus.busId === selectedBusId ? 3 : 2,
            }}
            eventHandlers={
              onSelectBus
                ? {
                    click: () => onSelectBus(bus.busId),
                  }
                : undefined
            }
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.9}>
              <div className="text-xs">
                <div className="font-semibold">{bus.busId}</div>
                <div>{bus.speed_kmh.toFixed(1)} km/h</div>
                <div>
                  {bus.lat.toFixed(4)}, {bus.lon.toFixed(4)}
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapView;
