"""Fraud network graph router."""
from fastapi import APIRouter, HTTPException

from app.schemas.graph import ClusterResponse
from app.services import graph_service

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/cluster/{cluster_id}", response_model=ClusterResponse)
def get_cluster(cluster_id: str) -> ClusterResponse:
    cluster = graph_service.get_cluster(cluster_id)
    if cluster is None:
        raise HTTPException(
            status_code=404,
            detail="Cluster not found (or Neo4j unavailable). Seeded demo id: "
                   "cluster-digital-arrest-001",
        )
    return cluster
