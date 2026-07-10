// ============================================================================
// Kavach — Neo4j seed: one demo fraud ring (~40 linked victim reports)
// ============================================================================
// Demonstrates B.5: dozens of "separate" reports collapse into one visible ring
// because they share a phone number, a UPI id, and a device fingerprint.
// ----------------------------------------------------------------------------

// The shared scammer infrastructure
MERGE (p:PhoneNumber {value: '9198765432'})
MERGE (u:UpiId       {value: 'scammer@okaxis'})
MERGE (d:Device      {fingerprint: 'dev-fp-CBI-ring-001'})
MERGE (c:Cluster     {id: 'cluster-digital-arrest-001'})
  SET c.scam_type = 'digital_arrest',
      c.label = 'CBI impersonation ring',
      c.report_count = 41;

// 41 victim reports, all wired to the shared infrastructure
UNWIND range(1, 41) AS i
MERGE (r:Report {id: 'seed-report-' + toString(i)})
  SET r.scam_type = 'digital_arrest',
      r.tier = 'high_risk'
MERGE (r)-[:USED_NUMBER]->(p)
MERGE (r)-[:PAID_TO]->(u)
MERGE (r)-[:FROM_DEVICE]->(d)
MERGE (r)-[:IN_CLUSTER]->(c);

// Sanity check (run manually): total reports in the ring
// MATCH (c:Cluster {id:'cluster-digital-arrest-001'})<-[:IN_CLUSTER]-(r:Report)
// RETURN c.label, count(r) AS reports;
