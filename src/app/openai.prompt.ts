export const  openaiPrompt = `
### Task
Generate SQL conditions to enforce row-level access control. These conditions should ensure users can only access or modify data based on their authorization, using relevant JWT claims and authenticated user information.

### Input
- **\`SchemaJson\`**: Defines the table structure necessary for constructing the conditions.
- **\`PermissionsJson\`**: Specifies role-based permissions and actions (e.g., which roles can perform \`select\`, \`insert\`, \`update\`, etc., on particular resources).
- **\`JWTClaims\`**: Contains user-specific claims, such as \`role\`, which indicate the user's permissions.

### Output
Generate SQL insert statements defining access control rules. Each rule should include a role, a resource (table), an action (CRUD operation), a condition, and parameter names in JSON format.

- Example SQL for defining access control:

  \`\`\`sql
  INSERT INTO role_permissions (role, resource, action, condition, parameter_names)
  VALUES
  ('admin', 'projects', 'select', '$id = (auth.jwt()->> ''project_id'')::integer', '{"$id"}'),
  ('manager', 'teams', 'update', '$id IN (SELECT team_id FROM public.users_teams WHERE user_id = auth.uid())', '{"$id"}'),
  ('user', 'documents', 'insert', '$created_by = (auth.uid())::uuid', '{"$created_by"}');
  \`\`\`

- **Correct Example**:
  - These conditions properly use \`$\` prefixes for parameters and ensure that the parameter names are listed in the \`parameter_names\` array.

  \`\`\`sql
  ('user', 'documents', 'insert', '$created_by = auth.uid()', '{"$created_by"}')
  ('manager', 'teams', 'update', '$id IN (SELECT team_id FROM public.users_teams WHERE user_id = auth.uid()', '{"$id"}'),
  \`\`\`

- **Incorrect Example**:

  \`\`\`sql
  ('user', 'documents', 'insert', 'created_by = auth.uid()', '{"created_by"}')
  \`\`\`
  - Missing \`$\` prefix for the \`created_by\` parameter.

  \`\`\`sql
    ('manager', 'teams', 'update', 'public.teams.id IN (SELECT team_id FROM public.users_teams WHERE user_id = auth.uid())', '{""}'),
  \`\`\`
  - Using \`public.teams.id\` instead of \`$id\`, which will prevent dynamic value substitution at query execution. Also, the parameter name (\`$id\`) is missing from the \`parameter_names\` array.
  \`\`\`sql
    ('manager', 'teams', 'update', '$team_id IN (SELECT team_id FROM public.users_teams WHERE user_id = auth.uid())', '{"$team_id"}'),
  \`\`\`
  - Should use \`$id\` instead of \`$team_id\` since \`team_id\` column does not exist in the teams table, parameter_name should be a column within the table, i.e role_permission' resource.

  \`\`\`sql
  ('org_admin', 'documents', '*', 'public.documents.project_id = (auth.jwt()->> ''project_id'')::bigint', '{"$project_id"}'),
  \`\`\`
  - Should use $project_id instead of public.documents.project_id.




### Rules

- **Condition Construction**:
  Use JWT claims, table relationships, PostgreSQL functions (e.g., \`auth.uid()\`), and parameters (prefixed with \`$\`) to enforce row-level access. Each query should be parameterized dynamically based on authenticated user data.
  Example:
  \`\`\`sql
  $team_id IN (SELECT t.id FROM teams t WHERE t.manager_id = auth.uid())
  \`\`\`

- **JWT Claims**:
  Use claims from the JWT (e.g., \`role\`, \`organization_id\`) where necessary.
  Example:
  \`\`\`sql
  $organization_id = (auth.jwt()->> 'organization_id')::integer
  \`\`\`

- **Parameterization**:
  All SQL conditions must be parameterized, with each parameter prefixed with \`$\`. Ensure that each parameter corresponds to a valid column in the resource table and is listed in the \`parameter_names\` field.
  Example:
  \`\`\`sql
  $id = (auth.jwt()->> 'organization_id')::integer
  \`\`\`

- **Subqueries**:
  Use subqueries to filter rows based on user assignments where necessary.
  Example:
  \`\`\`sql
  $id IN (SELECT document_id FROM public.user_documents WHERE user_id = auth.uid())
  \`\`\`

- **Type Casting**:
  Cast JWT claims or user IDs to the appropriate data types (e.g., integer, UUID) as needed.

- **PostgreSQL Compatibility**:
  Ensure the SQL is compatible with PostgreSQL syntax, using fully qualified table names when necessary.

- **Authenticated User Function**:
  Use \`auth.uid()\` to refer to the authenticated user’s UUID.

- **Output Format**:
  The output should exclusively consist of SQL statements. Do not include explanations or additional content.
 <SchemaJson>$1</SchemaJson>
 <PermissionsJSON>$2</PermissionsJSON>
`
