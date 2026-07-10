// ============================================================================
// Kavach — Neo4j schema: constraints + indexes for the fraud network graph (B.5)
// ============================================================================
// Node labels : (:Report) (:PhoneNumber) (:UpiId) (:Account) (:Device)
// Relationships: (:Report)-[:USED_NUMBER]->(:PhoneNumber)
//                (:Report)-[:PAID_TO]->(:UpiId|:Account)
//                (:Report)-[:FROM_DEVICE]->(:Device)
//                (:Report)-[:IN_CLUSTER]->(:Cluster)
// Entities shared across reports create the implicit links that reveal a ring.
// ----------------------------------------------------------------------------

// Uniqueness constraints (also create backing indexes)
CREATE CONSTRAINT report_id IF NOT EXISTS
  FOR (r:Report)      REQUIRE r.id IS UNIQUE;
CREATE CONSTRAINT phone_value IF NOT EXISTS
  FOR (p:PhoneNumber) REQUIRE p.value IS UNIQUE;
CREATE CONSTRAINT upi_value IF NOT EXISTS
  FOR (u:UpiId)       REQUIRE u.value IS UNIQUE;
CREATE CONSTRAINT account_value IF NOT EXISTS
  FOR (a:Account)     REQUIRE a.value IS UNIQUE;
CREATE CONSTRAINT device_value IF NOT EXISTS
  FOR (d:Device)      REQUIRE d.fingerprint IS UNIQUE;
CREATE CONSTRAINT cluster_id IF NOT EXISTS
  FOR (c:Cluster)     REQUIRE c.id IS UNIQUE;

// Helpful lookup index
CREATE INDEX report_scam_type IF NOT EXISTS
  FOR (r:Report) ON (r.scam_type);
