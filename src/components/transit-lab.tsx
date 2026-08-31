"use client";

import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Download,
  Flag,
  GitBranch,
  MapPin,
  RefreshCw,
  Route as RouteIcon,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  RouteSuccess,
  RoutingAlgorithm,
  RoutingPreference,
} from "@/domain";
import { api, apiEnvelope, ApiClientError } from "@/lib/api-client";
import type {
  NetworkDto,
  RouteCalculationDto,
  SavedRouteDto,
  ScenarioDto,
} from "@/shared/api-types";
import { NetworkMap } from "./network-map";

interface FormState {
  originStationId: string;
  destinationStationId: string;
  algorithm: RoutingAlgorithm;
  preference: RoutingPreference;
  transferPenaltyMinutes: number;
}

interface DisruptionState {
  closedStationIds: string[];
  suspendedLineIds: string[];
  lineDelays: Record<string, number>;
}

const emptyDisruptions: DisruptionState = {
  closedStationIds: [],
  suspendedLineIds: [],
  lineDelays: {},
};

const emptyForm: FormState = {
  originStationId: "",
  destinationStationId: "",
  algorithm: "ASTAR",
  preference: "FASTEST",
  transferPenaltyMinutes: 4,
};

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    const details = error.details
      .slice(0, 3)
      .map((detail) => `${detail.path}: ${detail.message}`)
      .join(" · ");
    return details ? `${error.message} ${details}` : error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something unexpected happened.";
}

async function requestCalculation(
  networkId: string,
  form: FormState,
  disruptions: DisruptionState,
) {
  return api<RouteCalculationDto>("/api/routes/calculate", {
    method: "POST",
    body: JSON.stringify({ networkId, ...form, disruptions }),
  });
}

export function TransitLab() {
  const [network, setNetwork] = useState<NetworkDto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [disruptions, setDisruptions] =
    useState<DisruptionState>(emptyDisruptions);
  const [calculation, setCalculation] = useState<RouteCalculationDto | null>(
    null,
  );
  const [scenarios, setScenarios] = useState<ScenarioDto[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<SavedRouteDto[]>([]);
  const [scenarioPage, setScenarioPage] = useState(1);
  const [scenarioPages, setScenarioPages] = useState(1);
  const [scenarioQuery, setScenarioQuery] = useState("");
  const [scenarioName, setScenarioName] = useState("");
  const [routeName, setRouteName] = useState("");
  const [closeCandidate, setCloseCandidate] = useState("");
  const [selectionMode, setSelectionMode] = useState<"origin" | "destination">(
    "origin",
  );
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [message, setMessage] = useState("Loading the seeded transit network…");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function refreshLibraries(
    networkId: string,
    page = scenarioPage,
    query = scenarioQuery,
  ) {
    const [scenarioResponse, routeResponse] = await Promise.all([
      apiEnvelope<ScenarioDto[]>(
        `/api/scenarios?networkId=${encodeURIComponent(networkId)}&page=${page}&pageSize=4&query=${encodeURIComponent(query)}`,
      ),
      apiEnvelope<SavedRouteDto[]>(
        `/api/saved-routes?networkId=${encodeURIComponent(networkId)}&page=1&pageSize=4`,
      ),
    ]);
    setScenarios(scenarioResponse.data);
    setScenarioPages(scenarioResponse.meta?.totalPages ?? 1);
    setSavedRoutes(routeResponse.data);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const summaries =
          await api<Array<{ id: string; isBuiltIn: boolean }>>("/api/networks");
        const selected =
          summaries.find((item) => item.isBuiltIn) ?? summaries[0];
        if (!selected)
          throw new Error(
            "No transit network is available. Run npm run db:init.",
          );
        const loaded = await api<NetworkDto>(
          `/api/networks/${encodeURIComponent(selected.id)}`,
        );
        const origin =
          loaded.stations.find((station) => station.code === "WPK") ??
          loaded.stations[0];
        const destination =
          loaded.stations.find((station) => station.code === "NTG") ??
          loaded.stations.at(-1)!;
        const nextForm = {
          ...emptyForm,
          originStationId: origin.id,
          destinationStationId: destination.id,
          transferPenaltyMinutes: loaded.transferPenaltyMinutes,
        };
        const nextCalculation = await requestCalculation(
          loaded.id,
          nextForm,
          emptyDisruptions,
        );
        if (!active) return;
        setNetwork(loaded);
        setForm(nextForm);
        setCalculation(nextCalculation);
        await refreshLibraries(loaded.id, 1, "");
        setMessage(
          "Sample route ready. Change the network and watch the graph adapt.",
        );
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
    // The initial load intentionally runs once; subsequent refreshes are user initiated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
    if (calculation) setStale(true);
  }

  function updateDisruptions(next: DisruptionState) {
    setDisruptions(next);
    if (calculation) setStale(true);
  }

  async function calculate(nextForm = form, nextDisruptions = disruptions) {
    if (!network) return;
    if (!nextForm.originStationId || !nextForm.destinationStationId) {
      setError("Choose both an origin and destination.");
      return;
    }
    if (nextForm.originStationId === nextForm.destinationStationId) {
      setError("Origin and destination must be different.");
      return;
    }
    setCalculating(true);
    setError("");
    setMessage(
      "Calculating the baseline and simulated route through the backend…",
    );
    try {
      const result = await requestCalculation(
        network.id,
        nextForm,
        nextDisruptions,
      );
      setCalculation(result);
      setStale(false);
      setMessage(
        result.active.status === "ok"
          ? "Route calculated from the persisted network."
          : result.active.message,
      );
    } catch (calculationError) {
      setError(errorMessage(calculationError));
    } finally {
      setCalculating(false);
    }
  }

  function selectSampleTrip() {
    if (!network) return;
    const origin =
      network.stations.find((station) => station.code === "HBR") ??
      network.stations[0];
    const destination =
      network.stations.find((station) => station.code === "AIR") ??
      network.stations.at(-1)!;
    const next = {
      ...form,
      originStationId: origin.id,
      destinationStationId: destination.id,
    };
    setForm(next);
    setDisruptions(emptyDisruptions);
    void calculate(next, emptyDisruptions);
  }

  function selectStation(stationId: string) {
    if (selectionMode === "origin") {
      updateForm({ originStationId: stationId });
      setSelectionMode("destination");
    } else {
      updateForm({ destinationStationId: stationId });
    }
  }

  function toggleSuspension(lineId: string) {
    const suspended = disruptions.suspendedLineIds.includes(lineId)
      ? disruptions.suspendedLineIds.filter((id) => id !== lineId)
      : [...disruptions.suspendedLineIds, lineId];
    updateDisruptions({ ...disruptions, suspendedLineIds: suspended });
  }

  function setLineDelay(lineId: string, minutes: number) {
    const lineDelays = { ...disruptions.lineDelays };
    if (minutes > 0) lineDelays[lineId] = minutes;
    else delete lineDelays[lineId];
    updateDisruptions({ ...disruptions, lineDelays });
  }

  async function saveScenario() {
    if (!network || !scenarioName.trim()) {
      setError("Give the scenario a name before saving it.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api<ScenarioDto>("/api/scenarios", {
        method: "POST",
        body: JSON.stringify({
          networkId: network.id,
          name: scenarioName,
          description: "Saved from the TransitLab workbench.",
          ...form,
          disruptions,
        }),
      });
      setScenarioName("");
      setScenarioPage(1);
      await refreshLibraries(network.id, 1, scenarioQuery);
      setMessage("Scenario saved to SQLite through the backend API.");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function saveRoute() {
    if (!network || !routeName.trim() || calculation?.active.status !== "ok") {
      setError("Calculate a reachable route and give it a name before saving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api<SavedRouteDto>("/api/saved-routes", {
        method: "POST",
        body: JSON.stringify({
          networkId: network.id,
          name: routeName,
          ...form,
          disruptions,
        }),
      });
      setRouteName("");
      await refreshLibraries(network.id);
      setMessage("Route recalculated and saved as a database snapshot.");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function loadScenario(scenario: ScenarioDto) {
    const nextForm = {
      originStationId: scenario.originStationId,
      destinationStationId: scenario.destinationStationId,
      algorithm: scenario.algorithm,
      preference: scenario.preference,
      transferPenaltyMinutes: scenario.transferPenaltyMinutes,
    };
    setForm(nextForm);
    setDisruptions(scenario.disruptions);
    void calculate(nextForm, scenario.disruptions);
  }

  async function removeScenario(scenarioId: string) {
    if (!network) return;
    try {
      await api<void>(`/api/scenarios/${encodeURIComponent(scenarioId)}`, {
        method: "DELETE",
      });
      await refreshLibraries(network.id);
      setMessage("Scenario removed from the database.");
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  }

  async function searchScenarios() {
    if (!network) return;
    try {
      setScenarioPage(1);
      await refreshLibraries(network.id, 1, scenarioQuery);
    } catch (searchError) {
      setError(errorMessage(searchError));
    }
  }

  async function changeScenarioPage(page: number) {
    if (!network) return;
    setScenarioPage(page);
    try {
      await refreshLibraries(network.id, page, scenarioQuery);
    } catch (pageError) {
      setError(errorMessage(pageError));
    }
  }

  async function importFile(file: File) {
    setError("");
    try {
      const json = JSON.parse(await file.text()) as unknown;
      const imported = await api<NetworkDto>("/api/networks/import", {
        method: "POST",
        body: JSON.stringify(json),
      });
      const nextForm = {
        ...emptyForm,
        originStationId: imported.stations[0].id,
        destinationStationId: imported.stations.at(-1)!.id,
        transferPenaltyMinutes: imported.transferPenaltyMinutes,
      };
      setNetwork(imported);
      setForm(nextForm);
      setDisruptions(emptyDisruptions);
      setScenarioPage(1);
      await refreshLibraries(imported.id, 1, "");
      await calculateImported(imported, nextForm);
      setMessage(
        `Imported ${imported.stations.length} stations and ${imported.connections.length} connections in one transaction.`,
      );
    } catch (importError) {
      setError(
        errorMessage(
          importError instanceof SyntaxError
            ? new Error("The selected file is not valid JSON.")
            : importError,
        ),
      );
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function calculateImported(imported: NetworkDto, nextForm: FormState) {
    setCalculating(true);
    try {
      setCalculation(
        await requestCalculation(imported.id, nextForm, emptyDisruptions),
      );
      setStale(false);
    } finally {
      setCalculating(false);
    }
  }

  async function exportCurrentNetwork() {
    if (!network) return;
    try {
      const data = await api<unknown>(
        `/api/networks/${encodeURIComponent(network.id)}/export`,
      );
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${network.slug}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Exported the validated public network format.");
    } catch (exportError) {
      setError(errorMessage(exportError));
    }
  }

  async function resetNetwork() {
    if (
      !window.confirm(
        "Restore the built-in Alder City network? This removes its saved scenarios and route snapshots, but preserves imported custom networks.",
      )
    )
      return;
    setLoading(true);
    setError("");
    try {
      const restored = await api<NetworkDto>("/api/reset", { method: "POST" });
      const origin =
        restored.stations.find((station) => station.code === "WPK") ??
        restored.stations[0];
      const destination =
        restored.stations.find((station) => station.code === "NTG") ??
        restored.stations.at(-1)!;
      const nextForm = {
        ...emptyForm,
        originStationId: origin.id,
        destinationStationId: destination.id,
        transferPenaltyMinutes: restored.transferPenaltyMinutes,
      };
      setNetwork(restored);
      setForm(nextForm);
      setDisruptions(emptyDisruptions);
      setCalculation(
        await requestCalculation(restored.id, nextForm, emptyDisruptions),
      );
      await refreshLibraries(restored.id, 1, "");
      setMessage("Alder City was restored from the deterministic server seed.");
    } catch (resetError) {
      setError(errorMessage(resetError));
    } finally {
      setLoading(false);
    }
  }

  if (loading && !network) return <LoadingWorkspace />;
  if (!network)
    return (
      <FatalWorkspace error={error} onRetry={() => window.location.reload()} />
    );

  const activeRoute =
    calculation?.active.status === "ok" ? calculation.active : null;
  const activeDisruptionCount =
    disruptions.closedStationIds.length +
    disruptions.suspendedLineIds.length +
    Object.keys(disruptions.lineDelays).length;
  const stationName = (id: string) =>
    network.stations.find((station) => station.id === id)?.name ??
    "Unknown station";
  const lineFor = (id: string) => network.lines.find((line) => line.id === id);

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            TL
          </span>
          <div>
            <strong>TransitLab</strong>
            <span>Route intelligence studio</span>
          </div>
        </div>
        <div className="header-network">
          <span className="status-dot" />
          <div>
            <strong>{network.name}</strong>
            <span>
              {network.stations.length} stations · {network.connections.length}{" "}
              connections
            </span>
          </div>
        </div>
        <nav className="header-actions" aria-label="Network actions">
          <input
            ref={fileInput}
            id="network-import"
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) =>
              event.target.files?.[0] && void importFile(event.target.files[0])
            }
          />
          <label htmlFor="network-import" className="header-button">
            <Upload size={16} />
            Import
          </label>
          <button
            className="header-button"
            onClick={() => void exportCurrentNetwork()}
          >
            <Download size={16} />
            Export
          </button>
          <button
            className="header-button header-button-danger"
            onClick={() => void resetNetwork()}
          >
            <RefreshCw size={16} />
            Reset seed
          </button>
        </nav>
      </header>

      <div className="system-message" aria-live="polite">
        <span
          className={error ? "message-light message-error" : "message-light"}
        >
          {error ? <AlertTriangle size={16} /> : <Check size={16} />}
          {error || message}
        </span>
        <span className="backend-badge">
          <Database size={14} />
          Next.js API · Prisma · SQLite
        </span>
      </div>

      <div className="workbench">
        <aside className="control-panel" aria-labelledby="planner-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Journey</p>
              <h1 id="planner-heading">Plan the route.</h1>
            </div>
            <button className="text-button" onClick={selectSampleTrip}>
              Try sample
            </button>
          </div>

          <div className="field-stack">
            <label className="field-label" htmlFor="origin">
              <MapPin size={15} />
              Origin
            </label>
            <select
              id="origin"
              value={form.originStationId}
              onChange={(event) =>
                updateForm({ originStationId: event.target.value })
              }
            >
              {network.stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                  {station.accessible ? "" : " · not accessible"}
                </option>
              ))}
            </select>
            <button
              className="swap-button"
              aria-label="Swap origin and destination"
              onClick={() =>
                updateForm({
                  originStationId: form.destinationStationId,
                  destinationStationId: form.originStationId,
                })
              }
            >
              <ArrowUpDown size={16} />
            </button>
            <label className="field-label" htmlFor="destination">
              <Flag size={15} />
              Destination
            </label>
            <select
              id="destination"
              value={form.destinationStationId}
              onChange={(event) =>
                updateForm({ destinationStationId: event.target.value })
              }
            >
              {network.stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                  {station.accessible ? "" : " · not accessible"}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="choice-fieldset">
            <legend>Optimize for</legend>
            <div className="choice-grid preference-grid">
              {(
                [
                  ["FASTEST", "Fastest", "Time + transfer penalty"],
                  ["FEWEST_TRANSFERS", "Fewer changes", "Transfers first"],
                  ["ACCESSIBLE", "Accessible", "Step-free links only"],
                ] as const
              ).map(([value, label, caption]) => (
                <button
                  key={value}
                  type="button"
                  className={
                    form.preference === value
                      ? "choice-card is-selected"
                      : "choice-card"
                  }
                  aria-pressed={form.preference === value}
                  onClick={() => updateForm({ preference: value })}
                >
                  <strong>{label}</strong>
                  <span>{caption}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="algorithm-row">
            <div>
              <span className="field-legend">Algorithm</span>
              <small>Same optimum, different search strategy</small>
            </div>
            <div className="segmented-control">
              {(["DIJKSTRA", "ASTAR"] as const).map((algorithm) => (
                <button
                  key={algorithm}
                  className={form.algorithm === algorithm ? "is-active" : ""}
                  aria-pressed={form.algorithm === algorithm}
                  onClick={() => updateForm({ algorithm })}
                >
                  {algorithm === "ASTAR" ? "A*" : "Dijkstra"}
                </button>
              ))}
            </div>
          </div>

          <button
            className="primary-action"
            disabled={calculating}
            onClick={() => void calculate()}
          >
            {calculating ? (
              <>
                <RefreshCw className="spin" size={17} />
                Searching graph…
              </>
            ) : (
              <>
                {stale ? "Recalculate route" : "Calculate route"}
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <section
            className="disruption-console"
            aria-labelledby="disruption-heading"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Simulation</p>
                <h2 id="disruption-heading">Disrupt the network.</h2>
              </div>
              {activeDisruptionCount > 0 && (
                <button
                  className="text-button"
                  onClick={() => updateDisruptions(emptyDisruptions)}
                >
                  Clear all
                </button>
              )}
            </div>
            <label className="field-label" htmlFor="close-station">
              Close a station
            </label>
            <div className="inline-field">
              <select
                id="close-station"
                value={closeCandidate}
                onChange={(event) => setCloseCandidate(event.target.value)}
              >
                <option value="">Choose station…</option>
                {network.stations
                  .filter(
                    (station) =>
                      !disruptions.closedStationIds.includes(station.id),
                  )
                  .map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.name}
                    </option>
                  ))}
              </select>
              <button
                className="secondary-action"
                disabled={!closeCandidate}
                onClick={() => {
                  if (closeCandidate)
                    updateDisruptions({
                      ...disruptions,
                      closedStationIds: [
                        ...disruptions.closedStationIds,
                        closeCandidate,
                      ],
                    });
                  setCloseCandidate("");
                }}
              >
                Close
              </button>
            </div>
            {disruptions.closedStationIds.length > 0 && (
              <div className="chip-row">
                {disruptions.closedStationIds.map((id) => (
                  <button
                    key={id}
                    className="disruption-chip"
                    onClick={() =>
                      updateDisruptions({
                        ...disruptions,
                        closedStationIds: disruptions.closedStationIds.filter(
                          (stationId) => stationId !== id,
                        ),
                      })
                    }
                  >
                    {stationName(id)}
                    <X size={13} />
                  </button>
                ))}
              </div>
            )}
            <div className="line-controls">
              {network.lines.map((line) => (
                <div className="line-control" key={line.id}>
                  <span
                    className="line-swatch"
                    style={{ backgroundColor: line.color }}
                  />
                  <div>
                    <strong>{line.name}</strong>
                    <span>Delay applies once when boarding</span>
                  </div>
                  <label className="suspend-control">
                    <input
                      type="checkbox"
                      checked={disruptions.suspendedLineIds.includes(line.id)}
                      onChange={() => toggleSuspension(line.id)}
                    />
                    <span>Suspend</span>
                  </label>
                  <label className="delay-control">
                    <span>+</span>
                    <input
                      aria-label={`${line.name} boarding delay in minutes`}
                      type="number"
                      min="0"
                      max="120"
                      value={disruptions.lineDelays[line.id] ?? 0}
                      onChange={(event) =>
                        setLineDelay(line.id, Number(event.target.value))
                      }
                    />
                    <span>min</span>
                  </label>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <div className="map-column">
          {activeDisruptionCount > 0 && (
            <div className="simulation-banner">
              <AlertTriangle size={16} />
              <strong>Simulation active</strong>
              <span>
                {activeDisruptionCount} modeled condition
                {activeDisruptionCount === 1 ? "" : "s"} · not live service data
              </span>
            </div>
          )}
          {stale && (
            <div className="stale-banner">
              <Clock3 size={15} />
              Route out of date — recalculate to apply your changes.
            </div>
          )}
          <NetworkMap
            network={network}
            route={activeRoute}
            originId={form.originStationId}
            destinationId={form.destinationStationId}
            closedStationIds={disruptions.closedStationIds}
            suspendedLineIds={disruptions.suspendedLineIds}
            delayedLineIds={Object.keys(disruptions.lineDelays)}
            selectionMode={selectionMode}
            onSelectionModeChange={setSelectionMode}
            onStationSelect={selectStation}
            zoom={zoom}
            onZoomChange={setZoom}
          />
        </div>

        <aside className="analysis-panel" aria-labelledby="analysis-heading">
          <p className="eyebrow">Route evidence</p>
          <h2 id="analysis-heading">Watch the graph adapt.</h2>
          {calculating ? (
            <AnalysisSkeleton />
          ) : calculation?.active.status === "unreachable" ? (
            <div className="unreachable-state">
              <span>
                <AlertTriangle size={20} />
              </span>
              <h3>No route found</h3>
              <p>{calculation.active.message}</p>
              <button
                className="secondary-action"
                onClick={() => {
                  updateDisruptions(emptyDisruptions);
                  void calculate(form, emptyDisruptions);
                }}
              >
                Clear disruptions and retry
              </button>
            </div>
          ) : activeRoute ? (
            <RouteAnalysis
              route={activeRoute}
              calculation={calculation!}
              stationName={stationName}
              lineFor={lineFor}
              stale={stale}
            />
          ) : (
            <div className="analysis-empty">
              <RouteIcon size={23} />
              <h3>No route yet</h3>
              <p>Choose two stations to compare shortest-path strategies.</p>
            </div>
          )}
          <div className="save-route-box">
            <label htmlFor="route-name">Save calculated route</label>
            <div className="inline-field">
              <input
                id="route-name"
                value={routeName}
                onChange={(event) => setRouteName(event.target.value)}
                placeholder="e.g. Airport commute"
                maxLength={80}
              />
              <button
                className="secondary-action"
                disabled={saving || !activeRoute}
                onClick={() => void saveRoute()}
              >
                <Save size={15} />
                Save
              </button>
            </div>
            <small>The server recalculates before writing the snapshot.</small>
          </div>
        </aside>
      </div>

      <section className="library-section" aria-labelledby="library-heading">
        <div className="library-intro">
          <p className="eyebrow eyebrow-light">Persistence</p>
          <h2 id="library-heading">Scenario library</h2>
          <p>
            Save the planner state, disruptions, and routing policy in SQLite.
            Refresh the browser—the records remain.
          </p>
          <div className="inline-field library-save">
            <input
              aria-label="New scenario name"
              value={scenarioName}
              onChange={(event) => setScenarioName(event.target.value)}
              placeholder="Morning closure test"
              maxLength={80}
            />
            <button
              className="primary-action compact"
              disabled={saving}
              onClick={() => void saveScenario()}
            >
              <Save size={15} />
              Save scenario
            </button>
          </div>
        </div>
        <div className="library-list">
          <div className="library-tools">
            <div className="search-field">
              <input
                aria-label="Filter scenarios"
                value={scenarioQuery}
                onChange={(event) => setScenarioQuery(event.target.value)}
                onKeyDown={(event) =>
                  event.key === "Enter" && void searchScenarios()
                }
                placeholder="Filter saved scenarios…"
              />
              <button
                aria-label="Search scenarios"
                onClick={() => void searchScenarios()}
              >
                <ArrowRight size={16} />
              </button>
            </div>
            <span>
              Page {scenarioPage} of {scenarioPages}
            </span>
          </div>
          {scenarios.length ? (
            <div className="scenario-grid">
              {scenarios.map((scenario) => (
                <article className="scenario-card" key={scenario.id}>
                  <div className="scenario-card-top">
                    <span>
                      {scenario.algorithm === "ASTAR" ? "A*" : "Dijkstra"} ·{" "}
                      {scenario.preference.replaceAll("_", " ").toLowerCase()}
                    </span>
                    <button
                      aria-label={`Delete ${scenario.name}`}
                      onClick={() => void removeScenario(scenario.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <h3>{scenario.name}</h3>
                  <p>
                    {stationName(scenario.originStationId)}{" "}
                    <ArrowRight size={13} />{" "}
                    {stationName(scenario.destinationStationId)}
                  </p>
                  <div>
                    <span>
                      {scenario.disruptions.closedStationIds.length} closures
                    </span>
                    <span>
                      {scenario.disruptions.suspendedLineIds.length} suspensions
                    </span>
                  </div>
                  <button
                    className="card-action"
                    onClick={() => loadScenario(scenario)}
                  >
                    Load scenario
                    <ArrowRight size={15} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="library-empty">
              <Database size={19} />
              <p>
                No scenarios match this filter. Save the current simulation to
                create one.
              </p>
            </div>
          )}
          <div className="pagination">
            <button
              disabled={scenarioPage <= 1}
              onClick={() => void changeScenarioPage(scenarioPage - 1)}
            >
              <ChevronLeft size={15} />
              Previous
            </button>
            <button
              disabled={scenarioPage >= scenarioPages}
              onClick={() => void changeScenarioPage(scenarioPage + 1)}
            >
              Next
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
        <div className="saved-route-list">
          <div className="saved-heading">
            <p className="eyebrow eyebrow-light">Snapshots</p>
            <h3>Saved routes</h3>
          </div>
          {savedRoutes.length ? (
            savedRoutes.map((route) => (
              <article key={route.id}>
                <div>
                  <strong>{route.name}</strong>
                  <span>
                    {stationName(route.originStationId)} →{" "}
                    {stationName(route.destinationStationId)}
                  </span>
                </div>
                <b>{route.totalMinutes} min</b>
              </article>
            ))
          ) : (
            <p className="saved-empty">
              Calculated route snapshots will appear here.
            </p>
          )}
        </div>
      </section>

      <footer className="site-footer">
        <span>TransitLab · A full-stack graph-routing laboratory</span>
        <span>Algorithms run server-side against persisted network data.</span>
      </footer>
    </main>
  );
}

function RouteAnalysis({
  route,
  calculation,
  stationName,
  lineFor,
  stale,
}: {
  route: RouteSuccess;
  calculation: RouteCalculationDto;
  stationName: (id: string) => string;
  lineFor: (id: string) => NetworkDto["lines"][number] | undefined;
  stale: boolean;
}) {
  return (
    <div className={stale ? "route-results is-stale" : "route-results"}>
      <div className="metric-grid">
        <div className="metric-primary">
          <strong>{route.totalMinutes}</strong>
          <span>minutes</span>
        </div>
        <div>
          <strong>{route.stopCount}</strong>
          <span>stops</span>
        </div>
        <div>
          <strong>{route.transferCount}</strong>
          <span>transfers</span>
        </div>
        <div>
          <strong>{route.nodesExplored}</strong>
          <span>states explored</span>
        </div>
      </div>
      <div className="route-summary">
        <div>
          <span>{route.algorithm === "ASTAR" ? "A* search" : "Dijkstra"}</span>
          <span>{route.preference.replaceAll("_", " ").toLowerCase()}</span>
        </div>
        <strong>
          {stationName(route.originStationId)} <ArrowRight size={14} />{" "}
          {stationName(route.destinationStationId)}
        </strong>
      </div>
      {calculation.comparison && (
        <div className="comparison-card">
          <div>
            <p className="eyebrow">Against baseline</p>
            <strong>
              {calculation.comparison.addedMinutes >= 0 ? "+" : ""}
              {calculation.comparison.addedMinutes} min
            </strong>
          </div>
          <div>
            <span>
              {calculation.comparison.transferDelta >= 0 ? "+" : ""}
              {calculation.comparison.transferDelta} transfers
            </span>
            <span>
              {calculation.comparison.routeChanged
                ? "Path changed"
                : "Same path"}
            </span>
          </div>
        </div>
      )}
      <section className="itinerary">
        <h3>Journey steps</h3>
        {route.steps.map((step, index) => {
          const line = lineFor(step.lineId);
          return (
            <div className="itinerary-step" key={step.directionId}>
              <span
                className="timeline-marker"
                style={{ background: line?.color }}
              />
              <div>
                <span>
                  {index === 0
                    ? "Board"
                    : step.isTransfer
                      ? "Transfer"
                      : "Continue"}{" "}
                  · {line?.name}
                </span>
                <strong>
                  {stationName(step.fromStationId)} →{" "}
                  {stationName(step.toStationId)}
                </strong>
                <small>
                  {step.travelMinutes} min
                  {step.transferPenaltyMinutes
                    ? ` + ${step.transferPenaltyMinutes} transfer`
                    : ""}
                  {step.delayMinutes ? ` + ${step.delayMinutes} delay` : ""}
                </small>
              </div>
              <b>{step.cumulativeMinutes}</b>
            </div>
          );
        })}
      </section>
      <details className="why-route" open>
        <summary>
          <GitBranch size={16} />
          Why this route?
        </summary>
        <p>{route.explanation.objective}</p>
        <p>{route.explanation.summary}</p>
        <p className="heuristic-note">{route.explanation.heuristic}</p>
        {route.explanation.constraints.length > 0 && (
          <ul>
            {route.explanation.constraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

function LoadingWorkspace() {
  return (
    <main className="loading-screen">
      <div className="loading-brand">
        <span className="brand-mark">TL</span>
        <div>
          <strong>TransitLab</strong>
          <span>Preparing the routing workbench</span>
        </div>
      </div>
      <div className="loading-grid">
        <i />
        <i />
        <i />
      </div>
      <p>
        <RefreshCw className="spin" size={16} />
        Connecting to SQLite and loading Alder City…
      </p>
    </main>
  );
}

function FatalWorkspace({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <main className="fatal-screen">
      <AlertTriangle size={30} />
      <h1>TransitLab could not start</h1>
      <p>{error}</p>
      <button className="primary-action compact" onClick={onRetry}>
        Retry
        <RefreshCw size={16} />
      </button>
      <code>npm run db:init</code>
    </main>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="analysis-skeleton" aria-label="Calculating route">
      <i />
      <i />
      <i />
      <i />
      <p>Exploring graph states…</p>
    </div>
  );
}
