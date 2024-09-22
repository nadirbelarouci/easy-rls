import {coerceStringArray} from "@angular/cdk/coercion";

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
    AND nsp.nspname = 'public'
)

SELECT jsonb_build_object(
  'primary_keys', (SELECT json_agg(formatted_key) FROM primary_keys),
  'relations', (SELECT json_agg(
    table_name || '.' || key_column || ' references ' || referenced_table_name || '(' || referenced_key_column || ')'
  ) FROM foreign_keys)
);
`
export interface Schema {
  relations: string[];
  primary_keys: string[];
}

// Regular expression to validate the format
const relationRegex = /^(\w+)\.(\w+)\.(\w+)::(\w+)\s+references\s+(\w+)\.(\w+)\((\w+)::(\w+)\)$/;
const primaryKeyRegex = /^(\w+)\.(\w+)\(.*\)$/;

export function validateRelationsAndPrimaryKeys(schemaString: string): boolean {
  try {
    const schema: Schema = JSON.parse(schemaString);
    console.log(schema)

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
