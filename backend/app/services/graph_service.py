"""Fraud network graph service (B.5) — Neo4j entity linking & clustering.

Fails soft: if Neo4j is down, entity extraction still runs (so events are logged)
but graph writes are skipped with a warning.
"""
from __future__ import annotations

import logging
import re

from app.db.neo4j_client import get_driver
from app.schemas.graph import ClusterResponse, GraphEdge, GraphNode

logger = logging.getLogger(__name__)

_UPI_RE = re.compile(r"\b[\w.\-]{2,}@[a-zA-Z]{2,}\b")
_PHONE_RE = re.compile(r"\b(?:\+?91)?[6-9]\d{9}\b")
_ACCOUNT_RE = re.compile(r"\b\d{11,18}\b")


def extract_entities(text: str) -> dict[str, list[str]]:
    """Pull phone numbers, UPI ids, and account numbers out of free text."""
    return {
        "upi": sorted(set(_UPI_RE.findall(text))),
        "phone": sorted(set(_PHONE_RE.findall(text))),
        "account": sorted(set(_ACCOUNT_RE.findall(text))),
    }


def add_report_to_graph(report_id: str, scam_type: str | None, entities: dict[str, list[str]]) -> None:
    """Create/merge a :Report node and link it to any shared entities.

    Shared identifiers across reports create the implicit edges that reveal a ring.
    """
    driver = get_driver()
    if driver is None:
        logger.info("Skipping graph write for %s (Neo4j unavailable)", report_id)
        return

    label_map = {"phone": ("PhoneNumber", "value", "USED_NUMBER"),
                 "upi": ("UpiId", "value", "PAID_TO"),
                 "account": ("Account", "value", "PAID_TO")}

    with driver.session() as session:
        session.run(
            "MERGE (r:Report {id: $id}) SET r.scam_type = $scam_type",
            id=report_id, scam_type=scam_type or "unknown",
        )
        for kind, values in entities.items():
            node_label, prop, rel = label_map[kind]
            for value in values:
                session.run(
                    f"MERGE (e:{node_label} {{{prop}: $value}}) "
                    f"WITH e MATCH (r:Report {{id: $id}}) "
                    f"MERGE (r)-[:{rel}]->(e)",
                    value=value, id=report_id,
                )


def get_cluster(cluster_id: str) -> ClusterResponse | None:
    """Fetch a fraud ring cluster and its linked entities for visualization."""
    driver = get_driver()
    if driver is None:
        return None

    with driver.session() as session:
        meta = session.run(
            "MATCH (c:Cluster {id: $id})<-[:IN_CLUSTER]-(r:Report) "
            "RETURN c.label AS label, c.scam_type AS scam_type, count(r) AS n",
            id=cluster_id,
        ).single()
        if not meta:
            return None

        # Collect the shared-infrastructure nodes/edges (bounded for display).
        rows = session.run(
            "MATCH (c:Cluster {id: $id})<-[:IN_CLUSTER]-(r:Report)-[rel]->(e) "
            "RETURN DISTINCT labels(e)[0] AS label, "
            "coalesce(e.value, e.fingerprint) AS value, type(rel) AS rel LIMIT 100",
            id=cluster_id,
        )
        nodes: list[GraphNode] = [GraphNode(id=cluster_id, label="Cluster", value=meta["label"])]
        edges: list[GraphEdge] = []
        seen: set[str] = set()
        for row in rows:
            nid = f"{row['label']}:{row['value']}"
            if nid not in seen:
                nodes.append(GraphNode(id=nid, label=row["label"], value=row["value"]))
                seen.add(nid)
            edges.append(GraphEdge(source=cluster_id, target=nid, type=row["rel"]))

        return ClusterResponse(
            cluster_id=cluster_id,
            label=meta["label"],
            scam_type=meta["scam_type"],
            report_count=meta["n"],
            nodes=nodes,
            edges=edges,
        )
