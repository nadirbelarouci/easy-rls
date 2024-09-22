
export const SchemaQuery = `
WITH primary_keys AS (
  SELECT
    nspname || '.' || relname || '(' ||
    string_agg(attname || '::' || pg_catalog.format_type(att.atttypid, att.atttypmod), ', ') || ')'
    AS formatted_key
  FROM
    pg_constraint con
    INNER JOIN pg_class cl ON cl.oid = con.conrelid
    INNER JOIN pg_namespace nsp ON nsp.oid = cl.relnamespace
    INNER JOIN pg_attribute att ON att.attnum = ANY(con.conkey)
      AND att.attrelid = cl.oid
  WHERE
    con.contype = 'p'
    AND nsp.nspname = 'public'
  GROUP BY nspname, relname
),

foreign_keys AS (
  SELECT
    con.conname AS constraint_name,
    nsp.nspname || '.' || cl.relname AS table_name,
    att2.attname || '::' || pg_catalog.format_type(att2.atttypid, att2.atttypmod) AS key_column,
    nsp2.nspname || '.' || cl2.relname AS referenced_table_name,
    att.attname || '::' || pg_catalog.format_type(att.atttypid, att.atttypmod) AS referenced_key_column
  FROM
    pg_constraint con
    INNER JOIN pg_class cl ON cl.oid = con.conrelid
    INNER JOIN pg_namespace nsp ON nsp.oid = cl.relnamespace
    INNER JOIN pg_attribute att2 ON att2.attnum = ANY(con.conkey)
      AND att2.attrelid = cl.oid
    INNER JOIN pg_class cl2 ON cl2.oid = con.confrelid
    INNER JOIN pg_namespace nsp2 ON nsp2.oid = cl2.relnamespace
    INNER JOIN pg_attribute att ON att.attnum = ANY(con.confkey)
      AND att.attrelid = cl2.oid
  WHERE
    con.contype = 'f'
    AND nsp.nspname = 'public' -- Change this if you use another schema
)

SELECT jsonb_build_object(
  'primary_keys', (SELECT json_agg(formatted_key) FROM primary_keys),
  'relations', (SELECT json_agg(
    table_name || '.' || key_column || ' references ' || referenced_table_name || '(' || referenced_key_column || ')'
  ) FROM foreign_keys)
);
`
export const rbacSQL = `
-- IMPORTANT: READ https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac

-- generated SQL

CREATE TABLE IF NOT EXISTS
    role_permissions (
      role TEXT NOT NULL,
      resource TEXT NOT NULL,
      action TEXT NOT NULL,
      condition TEXT,
      parameter_names TEXT[] NOT NULL DEFAULT '{}',
      CONSTRAINT role_permissions_pkey PRIMARY KEY (role, resource, action)
);

CREATE TABLE IF NOT EXISTS
    user_roles (
       user_id uuid unique references auth.users (id) NOT NULL,
       role text NOT NULL,
       CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role)
);

alter table user_roles enable row level security;

alter table role_permissions enable row level security;

-- Create the auth hook function
create
    or replace function custom_access_token_hook (event jsonb) returns jsonb language plpgsql stable as $$
declare
    claims    jsonb;
    user_role text;
    org_id    bigint;
begin
    -- Fetch the user role in the user_roles table
    select role into user_role from public.user_roles where user_id = (event ->> 'user_id')::uuid;
    -- TODO add more claims here:
    select organization_id into org_id from public.users where users.guid = (event ->> 'user_id')::uuid;


    claims := event -> 'claims';

    if user_role is not null then
        -- Set the claim
        claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
    else
        claims := jsonb_set(claims, '{user_role}', 'null');
    end if;

    if org_id is not null then
        -- Set the claim
        claims := jsonb_set(claims, '{organization_id}', to_jsonb(org_id));
    else
        claims := jsonb_set(claims, '{organization_id}', 'null');
    end if;

    -- Update the 'claims' object in the original event
    event := jsonb_set(event, '{claims}', claims);

    -- Return the modified or original event
    return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;

grant
    execute on function custom_access_token_hook to supabase_auth_admin;

revoke
    execute on function custom_access_token_hook
    from
    authenticated,
    anon,
    public;

grant all on table user_roles to supabase_auth_admin;

revoke all on table user_roles
    from
    authenticated,
    anon,
    public;

create policy "Allow auth admin to read user roles" ON user_roles as permissive for
    select
    to supabase_auth_admin using (true);

grant all on table users to supabase_auth_admin;

create policy "Allow auth admin to read user organization_id " ON users as permissive for
    select
    to supabase_auth_admin using (true);


CREATE OR REPLACE FUNCTION public.authorize(
    requested_resource TEXT,
    requested_action TEXT,
    params jsonb
      ) RETURNS BOOLEAN AS $$
      DECLARE
      user_role           TEXT;
          permission_record   RECORD;
          result              boolean;
          formatted_condition TEXT;
          param_name          TEXT;
      BEGIN
      SELECT (auth.jwt() ->> 'user_role')::TEXT INTO user_role;

      SELECT *
      INTO permission_record
      FROM public.role_permissions
      WHERE role = user_role
        AND (resource = requested_resource OR resource = '*')
        AND (action = requested_action OR action = '*');

      IF NOT FOUND THEN
              -- Permission record not found
              RETURN FALSE;
      END IF;

          -- Handle empty/null condition
          IF permission_record.condition IS NULL OR permission_record.condition = '' THEN
              -- No condition, authorization granted.
              RETURN TRUE;
      END IF;

          formatted_condition := permission_record.condition;
          FOREACH param_name IN ARRAY permission_record.parameter_names LOOP
                      formatted_condition := replace(formatted_condition,
                                                     param_name::text,
                                                     params ->> param_name);
      END LOOP;


          -- Ensure proper quoting for strings within the condition
          formatted_condition := replace(formatted_condition, '"', '''');
          -- Evaluate the potentially formatted condition
      EXECUTE format('SELECT %s', formatted_condition)
          INTO result;

      -- Authorization result: true/false
      RETURN result;
END;


`
export const JsonExample = `Please provide a valid JSON object with the following structure:

{
  "relations": [
    "schema.table.column::type references schema.table(column::type)",
    // ... more relation strings
  ],
  "primary_keys": [
    "schema.table(column::type)",
    // ... more primary key strings
  ]
}

* Both "relations" and "primary_keys" arrays must be present and cannot be empty.
* Each relation string must adhere to the format: "schema.table.column::type references schema.table(column::type)"
* Each primary key string must adhere to the format: "schema.table(column::type)"

Example:

{
  "relations": [
    "public.users.organization_id::bigint references public.organizations(id::bigint)"
  ],
  "primary_keys": [
    "public.users(id::bigint)"
  ]
}`
export interface Schema {
  relations: string[];
  primary_keys: string[];
}

// Regular expression to validate the format
const relationRegex = /^(\w+)\.(\w+)\.(\w+)::(\w+)\s+references\s+(\w+)\.(\w+)\((\w+)::(\w+)\)$/;
const primaryKeyRegex = /^(\w+)\.(\w+)\(([^)]+)\)$/;  // Match table schema, table name, and columns with types

export function validateRelationsAndPrimaryKeys(schemaString: string): boolean {
  try {
    const schema: Schema = JSON.parse(schemaString);

    // Check if relations or primary_keys arrays are empty
    if (schema.relations.length === 0 || schema.primary_keys.length === 0) {
      return false;
    }

    // Validate relations
    for (const relation of schema.relations) {
      if (!relationRegex.test(relation)) {
        return false;
      }
    }

    // Validate primary keys
    for (const primaryKey of schema.primary_keys) {
      if (!primaryKeyRegex.test(primaryKey)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

export function getTableNamesFromPrimaryKeys(schema: Schema): Set<string> {
  try {

    // Check if primary_keys array is empty
    if (schema.primary_keys.length === 0) {
      return new Set();
    }

    const tableNames:   Set<string> = new Set();

    for (const primaryKey of schema.primary_keys) {
      const match = primaryKeyRegex.exec(primaryKey);
      if (match) {
        tableNames.add(match[2]); // Extract the table name
      }
    }

    return tableNames;
  } catch (error) {
    // Handle JSON parsing errors
    return new Set();
  }
}

export function deleteTableFromPrimaryKeys(schema: Schema, tableNameToDelete: string): Schema {
  const updatedPrimaryKeys = schema.primary_keys.filter(primaryKey => {
    const match = primaryKeyRegex.exec(primaryKey);
    return match && match[2] !== tableNameToDelete;
  });

  return {
    ...schema,
    primary_keys: updatedPrimaryKeys
  };
}

type Relation = {
  schema: string;
  table: string;
  column: string;
  refSchema: string;
  refTable: string;
  refColumn: string;
};

type PrimaryKey = {
  schema: string;
  table: string;
  columns: string[];
};

// Helper function to strip `::` and data types from columns
function stripColumnType(column: string): string {
  return column.split('::')[0];  // Split by '::' and take the column name before the type
}

function parsePrimaryKeys(primaryKeys: string[]): PrimaryKey[] {
  return primaryKeys.map((pk) => {
    const match = pk.match(primaryKeyRegex);
    if (!match) throw new Error(`Invalid primary key format: ${pk}`);
    const columnsWithTypes = match[3].split(', ');
    const columns = columnsWithTypes.map(stripColumnType); // Remove types from column names
    return {
      schema: match[1],
      table: match[2],
      columns: columns,
    };
  });
}

function parseRelations(relations: string[]): Relation[] {
  return relations.map((relation) => {
    const match = relation.match(relationRegex);
    if (!match) throw new Error(`Invalid relation format: ${relation}`);
    return {
      schema: match[1],
      table: match[2],
      column: stripColumnType(match[3]),  // Strip the column type
      refSchema: match[5],
      refTable: match[6],
      refColumn: stripColumnType(match[7]),  // Strip the referenced column type
    };
  });
}

function generateJsonBuildObject(table: PrimaryKey, foreignKeys: Relation[]): string {
  const seenKeys = new Set<string>();  // Track keys that have already been added

  const primaryKeyEntries = table.columns
    .filter((col) => {
      const key = `$${col}`;
      if (seenKeys.has(key)) return false;  // Skip if already added
      seenKeys.add(key);  // Mark this key as added
      return true;
    })
    .map((col) => `'$${col}', ${table.table}.${col}`)
    .join(',\n        ');

  const foreignKeyEntries = foreignKeys
    .filter((fk) => {
      const key = `$${fk.column}`;
      if (seenKeys.has(key)) return false;  // Skip if already added
      seenKeys.add(key);  // Mark this key as added
      return true;
    })
    .map((fk) => `'$${fk.column}', ${table.table}.${fk.column}`)
    .join(',\n        ');

  // Combine primary key and foreign key entries, ensuring no duplicates
  return [primaryKeyEntries, foreignKeyEntries].filter(Boolean).join(',\n        ');
}

function generateSelectPolicy(table: PrimaryKey, foreignKeys: Relation[]): string {
  const jsonBuildObject = generateJsonBuildObject(table, foreignKeys);

  return `CREATE POLICY "${table.table}_select" ON ${table.table}
    FOR SELECT
    TO authenticated
    USING (
      authorize(
        '${table.table}'::text,
        'select'::text,
        json_build_object(
          ${jsonBuildObject}
        )::jsonb
      )
    );`;
}

function generateInsertPolicy(table: PrimaryKey, foreignKeys: Relation[]): string {
  const jsonBuildObject = generateJsonBuildObject(table, foreignKeys);

  return `CREATE POLICY "${table.table}_insert" ON ${table.table}
    FOR INSERT
    TO authenticated
    WITH CHECK (
      authorize(
        '${table.table}'::text,
        'insert'::text,
        json_build_object(
          ${jsonBuildObject}
        )::jsonb
      )
    );`;
}

function generateUpdatePolicy(table: PrimaryKey, foreignKeys: Relation[]): string {
  const jsonBuildObject = generateJsonBuildObject(table, foreignKeys);

  return `CREATE POLICY "${table.table}_update" ON ${table.table}
    FOR UPDATE
    TO authenticated
    USING (
      authorize(
        '${table.table}'::text,
        'update'::text,
        json_build_object(
          ${jsonBuildObject}
        )::jsonb
      )
    );`;
}

function generateDeletePolicy(table: PrimaryKey, foreignKeys: Relation[]): string {
  const jsonBuildObject = generateJsonBuildObject(table, foreignKeys);

  return `CREATE POLICY "${table.table}_delete" ON ${table.table}
    FOR DELETE
    TO authenticated
    USING (
      authorize(
        '${table.table}'::text,
        'delete'::text,
        json_build_object(
          ${jsonBuildObject}
        )::jsonb
      )
    );`;
}

export function generatePolicies(data: { relations: string[]; primary_keys: string[] }) {
  const relations = parseRelations(data.relations);
  const primaryKeys = parsePrimaryKeys(data.primary_keys);

  let allPolicies = "";

  primaryKeys.forEach((table) => {
    const foreignKeys = relations.filter((rel) => rel.table === table.table);

    allPolicies += generateSelectPolicy(table, foreignKeys) + "\n";
    allPolicies += generateInsertPolicy(table, foreignKeys) + "\n";
    allPolicies += generateUpdatePolicy(table, foreignKeys) + "\n";
    allPolicies += generateDeletePolicy(table, foreignKeys) + "\n";
  });

  return allPolicies;
}

// Example usage
const jsonData = {
  relations: [
    "public.api_resource.app_zone_id::bigint references public.app_zones(id::bigint)",
    "public.api_resource.organization_id::bigint references public.organizations(id::bigint)",
    "public.override_tokens.app_zone_id::bigint references public.app_zones(id::bigint)",
    "public.override_tokens.organization_id::bigint references public.organizations(id::bigint)",
    "public.override_tokens.user_id::bigint references public.users(id::bigint)",
    "public.users.organization_id::bigint references public.organizations(id::bigint)",
    "public.app_zones.organization_id::bigint references public.organizations(id::bigint)",
    "public.users_app_zones.app_zone_id::bigint references public.app_zones(id::bigint)",
    "public.users_app_zones.organization_id::bigint references public.organizations(id::bigint)",
    "public.users_app_zones.user_id::bigint references public.users(id::bigint)",
    "public.user_roles.user_id::uuid references auth.users(id::uuid)"
  ],
  primary_keys: [
    "public.api_resource(id::bigint)",
    "public.app_zones(id::bigint)",
    "public.organizations(id::bigint)",
    "public.override_tokens(id::bigint)",
    "public.role_permissions(action::text, role::text, resource::text)",
    "public.user_roles(user_id::uuid, role::text)",
    "public.users(id::bigint)",
    "public.users_app_zones(user_id::bigint, organization_id::bigint, app_zone_id::bigint)"
  ]
};


