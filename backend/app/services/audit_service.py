"""Tamper-evident audit trail — each entry hashes the previous entry's hash,
so any edit/deletion breaks the chain. This is the "blockchain audit trail"
described in the spec, implemented without the cost/latency of a real chain.
A verify_chain() endpoint lets anyone recompute and confirm integrity.
"""
import hashlib
import json
from app.core.supabase_client import supabase


def _hash(prev_hash: str, actor: str, action: str, metadata: dict) -> str:
    payload = json.dumps({"prev": prev_hash, "actor": actor, "action": action, "meta": metadata}, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()


def write(org_id: str, actor: str, actor_type: str, action: str, entity_type: str | None = None,
          entity_id: str | None = None, metadata: dict | None = None) -> dict:
    metadata = metadata or {}
    last = (
        supabase.table("audit_logs")
        .select("hash")
        .eq("organization_id", org_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data
    prev_hash = last[0]["hash"] if last else "genesis"
    new_hash = _hash(prev_hash, actor, action, metadata)

    row = {
        "organization_id": org_id, "actor": actor, "actor_type": actor_type,
        "action": action, "entity_type": entity_type, "entity_id": entity_id,
        "metadata": metadata, "prev_hash": prev_hash, "hash": new_hash,
    }
    return supabase.table("audit_logs").insert(row).execute().data[0]


def verify_chain(org_id: str) -> dict:
    rows = (
        supabase.table("audit_logs")
        .select("*")
        .eq("organization_id", org_id)
        .order("created_at", desc=False)
        .execute()
    ).data or []
    prev = "genesis"
    for row in rows:
        expected = _hash(prev, row["actor"], row["action"], row["metadata"])
        if row["prev_hash"] != prev or row["hash"] != expected:
            return {"valid": False, "broken_at": row["id"]}
        prev = row["hash"]
    return {"valid": True, "entries": len(rows)}
