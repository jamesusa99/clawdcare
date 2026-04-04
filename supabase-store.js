const { createClient } = require("@supabase/supabase-js");

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    password_hash: r.password_hash,
    created_at: r.created_at,
    roles: Array.isArray(r.roles) ? r.roles : [],
  };
}

function mapPublic(r) {
  const m = mapRow(r);
  if (!m) return null;
  return {
    id: m.id,
    email: m.email,
    name: m.name,
    created_at: m.created_at,
    roles: m.roles,
  };
}

function createSupabaseStore(url, serviceRoleKey) {
  const sb = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async findByEmail(email) {
      const e = (email || "").trim().toLowerCase();
      const { data, error } = await sb.from("profiles").select("*").eq("email", e).maybeSingle();
      if (error) throw error;
      return mapRow(data);
    },
    async findById(id) {
      const { data, error } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return mapRow(data);
    },
    async createUser({ email, password_hash, name }) {
      const row = {
        email: (email || "").trim().toLowerCase(),
        password_hash: password_hash || null,
        name: name || null,
        roles: [],
      };
      const { data, error } = await sb.from("profiles").insert(row).select("*").single();
      if (error) throw error;
      return mapRow(data);
    },
    async listPublicUsers() {
      const { data, error } = await sb
        .from("profiles")
        .select("id, email, name, created_at, roles")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((r) => mapPublic(r));
    },
    async setUserRoles(id, roles) {
      const next = Array.isArray(roles) ? [...new Set(roles.filter((r) => typeof r === "string" && r.trim()))] : [];
      const { data, error } = await sb
        .from("profiles")
        .update({ roles: next })
        .eq("id", id)
        .select("id, email, name, created_at, roles")
        .maybeSingle();
      if (error) throw error;
      return data ? mapPublic(data) : null;
    },
    async updateUser(id, patch) {
      const allowed = ["email", "name", "password_hash", "roles"];
      const clean = {};
      for (const k of allowed) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) clean[k] = patch[k];
      }
      if (Object.keys(clean).length === 0) return this.findById(id);
      const { data, error } = await sb.from("profiles").update(clean).eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      return mapRow(data);
    },
  };
}

module.exports = { createSupabaseStore };
