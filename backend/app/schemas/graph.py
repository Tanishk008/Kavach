"""Contracts for the fraud network graph (B.5)."""
from pydantic import BaseModel


class GraphNode(BaseModel):
    id: str
    label: str  # Report | PhoneNumber | UpiId | Account | Device | Cluster
    value: str


class GraphEdge(BaseModel):
    source: str
    target: str
    type: str


class ClusterResponse(BaseModel):
    cluster_id: str
    label: str
    scam_type: str
    report_count: int
    nodes: list[GraphNode]
    edges: list[GraphEdge]
