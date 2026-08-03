import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.metrics import build_performance_metrics
from app.services.routing import build_intervention_plan, optimize_routes, prioritize_zones
from app.services.simulation import simulate_container_fill, simulate_route_progress


def test_prioritize_zones_ranks_critical_areas():
    zones = [
        {"id": 1, "name": "Centro Historico", "latitude": -13.5166, "longitude": -71.9789, "criticality": "Media"},
        {"id": 2, "name": "Wanchaq", "latitude": -13.5256, "longitude": -71.9558, "criticality": "Alta"},
    ]
    reports = [{"zone": "Centro Historico", "status": "Pendiente"}, {"zone": "Wanchaq", "status": "Pendiente"}]
    containers = [{"zone_id": 2, "fill_level": 90, "status": "Lleno"}]
    prioritized = prioritize_zones(zones, reports, containers)
    assert prioritized[0]["name"] == "Wanchaq"


def test_optimize_routes_orders_by_priority_and_delay():
    routes = [
        {"id": 1, "truck": "C-02", "zone": "Wanchaq", "progress": 20, "eta": "28 min", "delay": "Retraso moderado", "latitude": -13.5256, "longitude": -71.9558},
        {"id": 2, "truck": "C-01", "zone": "Centro Historico", "progress": 80, "eta": "5 min", "delay": "Sin retraso", "latitude": -13.5166, "longitude": -71.9789},
    ]
    optimized = optimize_routes(routes, ["Wanchaq", "Centro Historico"])
    assert optimized[0]["zone"] == "Wanchaq"


def test_build_intervention_plan_creates_actionable_steps():
    prioritized_zones = [
        {"id": 2, "name": "Wanchaq", "priority_score": 8, "criticality": "Alta"},
        {"id": 1, "name": "Centro Historico", "priority_score": 4, "criticality": "Media"},
    ]
    optimized_routes = [
        {"id": 1, "truck": "C-02", "zone": "Wanchaq", "progress": 20, "eta": "28 min", "delay": "Retraso moderado"},
        {"id": 2, "truck": "C-01", "zone": "Centro Historico", "progress": 80, "eta": "5 min", "delay": "Sin retraso"},
    ]
    plan = build_intervention_plan(prioritized_zones, optimized_routes)
    assert plan[0]["title"] == "Intervención prioritaria"
    assert "Wanchaq" in plan[0]["detail"]
    assert plan[1]["priority"] == "alta"


def test_build_performance_metrics_computes_operational_status():
    routes = [
        {"id": 1, "truck": "C-02", "zone": "Wanchaq", "progress": 20, "eta": "28 min", "delay": "Retraso moderado", "latitude": -13.5256, "longitude": -71.9558},
        {"id": 2, "truck": "C-01", "zone": "Centro Historico", "progress": 80, "eta": "5 min", "delay": "Sin retraso", "latitude": -13.5166, "longitude": -71.9789},
    ]
    reports = [{"zone": "Wanchaq", "status": "Pendiente"}]
    containers = [{"zone_id": 1, "fill_level": 90, "status": "Lleno"}]
    perf = build_performance_metrics(routes, reports, containers)
    assert perf["total_routes"] == 2
    assert perf["delayed_routes"] == 1
    assert perf["low_progress_routes"] == 1
    assert perf["average_progress"] == 50
    assert perf["open_reports"] == 1
    assert perf["average_container_fill"] == 90


def test_simulate_route_progress_advances_routes():
    routes = [
        {"id": 1, "truck": "C-02", "zone": "Wanchaq", "progress": 20, "eta": "28 min", "delay": "Retraso moderado"},
        {"id": 2, "truck": "C-01", "zone": "Centro Historico", "progress": 95, "eta": "5 min", "delay": "Sin retraso"},
    ]
    simulated = simulate_route_progress(routes)
    assert simulated[0]["progress"] == 30
    assert simulated[1]["progress"] == 100
    assert simulated[1]["delay"] == "Completado"


def test_simulate_container_fill_increases_fill_level():
    containers = [{"id": 1, "zone_id": 1, "name": "Contenedor 01", "fill_level": 85, "status": "Operativo"}]
    simulated = simulate_container_fill(containers)
    assert simulated[0]["fill_level"] == 90
    assert simulated[0]["status"] == "Lleno"
