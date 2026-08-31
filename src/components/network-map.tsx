"use client";

import { Accessibility, Minus, Plus, RotateCcw, Route } from "lucide-react";
import type { RouteSuccess } from "@/domain";
import type { NetworkDto } from "@/shared/api-types";

interface NetworkMapProps {
  network: NetworkDto;
  route: RouteSuccess | null;
  originId: string;
  destinationId: string;
  closedStationIds: string[];
  suspendedLineIds: string[];
  delayedLineIds: string[];
  selectionMode: "origin" | "destination";
  onSelectionModeChange: (mode: "origin" | "destination") => void;
  onStationSelect: (stationId: string) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export function NetworkMap({
  network,
  route,
  originId,
  destinationId,
  closedStationIds,
  suspendedLineIds,
  delayedLineIds,
  selectionMode,
  onSelectionModeChange,
  onStationSelect,
  zoom,
  onZoomChange,
}: NetworkMapProps) {
  const stations = new Map(
    network.stations.map((station) => [station.id, station]),
  );
  const lines = new Map(network.lines.map((line) => [line.id, line]));
  const routeConnectionIds = new Set(
    route?.steps.map((step) => step.connectionId) ?? [],
  );
  const hasRoute = routeConnectionIds.size > 0;

  return (
    <section className="map-panel" aria-labelledby="network-map-title">
      <div className="map-toolbar">
        <div>
          <p className="eyebrow eyebrow-light">Network canvas</p>
          <h2 id="network-map-title">{network.name}</h2>
        </div>
        <div className="map-actions" aria-label="Map controls">
          <div className="selection-toggle" aria-label="Station click assigns">
            <button
              className={selectionMode === "origin" ? "is-active" : ""}
              onClick={() => onSelectionModeChange("origin")}
            >
              Set origin
            </button>
            <button
              className={selectionMode === "destination" ? "is-active" : ""}
              onClick={() => onSelectionModeChange("destination")}
            >
              Set destination
            </button>
          </div>
          <button
            className="icon-button icon-button-dark"
            aria-label="Zoom out"
            onClick={() => onZoomChange(Math.max(0.8, zoom - 0.1))}
          >
            <Minus size={16} />
          </button>
          <button
            className="icon-button icon-button-dark"
            aria-label="Reset zoom"
            onClick={() => onZoomChange(1)}
          >
            <RotateCcw size={15} />
          </button>
          <button
            className="icon-button icon-button-dark"
            aria-label="Zoom in"
            onClick={() => onZoomChange(Math.min(1.4, zoom + 0.1))}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="network-stage">
        <svg
          viewBox="0 0 800 600"
          className="network-svg"
          style={{ transform: `scale(${zoom})` }}
          role="img"
          aria-labelledby="network-svg-title network-svg-desc"
        >
          <title id="network-svg-title">
            Interactive map of {network.name}
          </title>
          <desc id="network-svg-desc">
            Choose whether a station click sets the origin or destination.
            Closed stations are crossed out and suspended lines are dashed.
          </desc>
          <g className="track-layer">
            {network.connections.map((connection) => {
              const from = stations.get(connection.fromStationId)!;
              const to = stations.get(connection.toStationId)!;
              const line = lines.get(connection.lineId)!;
              const suspended = suspendedLineIds.includes(connection.lineId);
              const delayed = delayedLineIds.includes(connection.lineId);
              return (
                <line
                  key={connection.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={line.color}
                  className={`network-track ${hasRoute && !routeConnectionIds.has(connection.id) ? "is-muted" : ""} ${suspended ? "is-suspended" : ""} ${delayed ? "is-delayed" : ""}`}
                />
              );
            })}
            {network.connections
              .filter((connection) => routeConnectionIds.has(connection.id))
              .map((connection) => {
                const from = stations.get(connection.fromStationId)!;
                const to = stations.get(connection.toStationId)!;
                return (
                  <line
                    key={`route-${connection.id}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className="route-track"
                  />
                );
              })}
          </g>
          <g className="station-layer">
            {network.stations.map((station) => {
              const servedLines = network.connections
                .filter(
                  (connection) =>
                    connection.fromStationId === station.id ||
                    connection.toStationId === station.id,
                )
                .map((connection) => lines.get(connection.lineId)!)
                .filter(
                  (line, index, all) =>
                    all.findIndex((item) => item.id === line.id) === index,
                );
              const closed = closedStationIds.includes(station.id);
              const isOrigin = station.id === originId;
              const isDestination = station.id === destinationId;
              const isTransfer = servedLines.length > 1;
              const onActivate = () => onStationSelect(station.id);
              return (
                <g
                  key={station.id}
                  className={`station-node ${closed ? "is-closed" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${station.name}, ${servedLines.map((line) => line.name).join(" and ")}${station.accessible ? ", wheelchair accessible" : ", not wheelchair accessible"}${closed ? ", closed" : ""}. Set as ${selectionMode}.`}
                  onClick={onActivate}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onActivate();
                    }
                  }}
                >
                  <title>
                    {station.name} ·{" "}
                    {servedLines.map((line) => line.code).join(" / ")}
                  </title>
                  {isOrigin && (
                    <circle
                      cx={station.x}
                      cy={station.y}
                      r={18}
                      className="origin-ring"
                    />
                  )}
                  <circle
                    cx={station.x}
                    cy={station.y}
                    r={isTransfer ? 10 : 8}
                    className={
                      isDestination ? "destination-dot" : "station-dot"
                    }
                  />
                  {closed && (
                    <path
                      d={`M${station.x - 12} ${station.y - 12} L${station.x + 12} ${station.y + 12} M${station.x + 12} ${station.y - 12} L${station.x - 12} ${station.y + 12}`}
                      className="closure-cross"
                    />
                  )}
                  {station.accessible && (
                    <circle
                      cx={station.x + 10}
                      cy={station.y - 10}
                      r={3.5}
                      className="accessible-dot"
                    />
                  )}
                  <text
                    x={station.x}
                    y={station.y + 28}
                    textAnchor="middle"
                    className="station-label"
                  >
                    {station.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        {!route && (
          <div className="map-empty-note">
            <Route size={18} />
            <span>Select two stations, then calculate a route.</span>
          </div>
        )}
      </div>

      <footer className="map-legend">
        {network.lines.map((line) => (
          <span key={line.id}>
            <i style={{ background: line.color }} />
            {line.name}
          </span>
        ))}
        <span>
          <Accessibility size={14} />
          Accessible
        </span>
        <span>
          <i className="legend-closed" />
          Closed
        </span>
      </footer>
    </section>
  );
}
