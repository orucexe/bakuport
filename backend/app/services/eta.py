"""Distance along an ordered, closed route; coordinates use latitude/longitude."""
import math
from dataclasses import dataclass


def haversine(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lat2 = math.radians(a[0]), math.radians(b[0])
    dlat, dlng = lat2 - lat1, math.radians(b[1] - a[1])
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 6371 * 2 * math.asin(min(1, math.sqrt(h)))


@dataclass
class Projection:
    progress_km: float
    distance_from_route_km: float


def project_to_route(point: tuple[float, float], stops: list[tuple[float, float]]) -> Projection:
    if len(stops) < 2:
        return Projection(0, float("inf"))
    scale = math.cos(math.radians(point[0]))
    closest = Projection(0, float("inf"))
    cumulative = 0.0
    for a, b in zip(stops, stops[1:] + stops[:1]):
        ax, ay = (a[1] - point[1]) * scale, a[0] - point[0]
        bx, by = (b[1] - point[1]) * scale, b[0] - point[0]
        dx, dy = bx - ax, by - ay
        fraction = max(0, min(1, -(ax * dx + ay * dy) / max(dx * dx + dy * dy, 1e-15)))
        projected = (a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction)
        offset = haversine(point, projected)
        length = haversine(a, b)
        if offset < closest.distance_from_route_km:
            closest = Projection(cumulative + fraction * length, offset)
        cumulative += length
    return closest


def eta_minutes(point: tuple[float, float], stops: list[tuple[float, float]],
                target_index: int, speeds: list[float]) -> float | None:
    projection = project_to_route(point, stops)
    if projection.distance_from_route_km > 0.5:
        return None
    target_distance = sum(haversine(a, b) for a, b in zip(stops[:target_index], stops[1:target_index + 1]))
    remaining = target_distance - projection.progress_km
    if remaining < -0.02:
        return None
    speed = max(5, sum(speeds) / len(speeds)) if speeds else 18
    return round(max(0, remaining) / speed * 60, 1)
