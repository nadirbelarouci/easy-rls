# EasyRLS

This document outlines the implementation of Row-Level Security (RLS) and Role-Based Access Control (RBAC) in PostgreSQL using dynamic role conditions. This setup employs user roles, permissions, and dynamic SQL conditions stored in JSON objects to enforce fine-grained access control.

## Key Components

### 1. **Tables**:
- **`user_roles`**: Stores the roles assigned to users. A role defines what actions and resources the user can access.
- **`role_permissions`**: Specifies the permissions for each role, including accessible resources, allowed actions, and any conditional logic for the permissions.

### 2. **Custom Access Token Hook**:
A function (`custom_access_token_hook`) dynamically injects custom claims like `user_role` and `organization_id` into the JWT token during authentication. These claims are later used for authorization checks.

### [3. **Authorization Function (`authorize`)**:](https://github.com/nadirbelarouci/easy-rls/blob/main/src/app/schema.ts#L144)
The `authorize` function evaluates whether a user can perform a specific action on a resource. It retrieves the user's role from the JWT token, looks up the corresponding permission, and dynamically evaluates conditions defined in the `role_permissions` table.

---

## Authorization Workflow

### 1. **Role Permissions Table**
Each role's permissions are defined in the `role_permissions` table:
- **`role`**: Name of the role (e.g., `admin`, `user`, `zone_admin`).
- **`resource`**: The database table or resource the role can access (e.g., `app_zones`, `users`).
- **`action`**: The action allowed for the role (e.g., `select`, `insert`, `update`, `delete`).
- **`condition`**: Optional SQL logic that determines if the action is permitted.
- **`parameter_names`**: A list of parameters injected into the dynamic condition.

### 2. **Dynamic SQL and JSON Parameters**
In the `authorize` function, conditions are generated dynamically using JSON parameters. For instance, a condition like `"$organization_id = (auth.jwt() ->> 'organization_id')::bigint"` matches the `organization_id` from the JWT claim with the corresponding resource attribute.

The `params` argument is a JSON object populated with relevant parameters:
```sql
json_build_object(
    '$id', app_zones.id,
    '$organization_id', app_zones.organization_id
)
```
This JSON object is passed to the `authorize` function, where the parameters are injected into the SQL condition.

### 3. **Policy Creation**
Policies are defined for each resource to enforce RLS. Example:
```sql
CREATE POLICY "app_zones_select" ON app_zones
    FOR SELECT
    TO authenticated
    USING (
      authorize(
        'app_zones'::text,
        'select'::text,
        json_build_object(
          '$id', app_zones.id,
          '$organization_id', app_zones.organization_id
        )::jsonb
      )
    );
```
When a user attempts to `SELECT` rows from the `app_zones` table, this policy checks the user's permissions via the `authorize` function.

### 4. **Handling Conditions in `authorize`**
The `authorize` function processes the dynamic conditions for each permission:
- **Parameter Injection**: The function replaces placeholders in the condition string with actual values from the JSON object.
- **Condition Execution**: After parameters are injected, the condition is executed as SQL, and the result (true/false) determines whether access is granted.

Example of a condition:
```sql
'$organization_id = (auth.jwt() ->> ''organization_id'')::bigint'
```
The `$organization_id` is replaced with the value from the `params` JSON object before execution.

---

## Example Scenario

1. A user logs in with the role `admin`.
2. Their JWT token contains claims such as `organization_id`.
3. The user attempts to `SELECT` from the `app_zones` table.
4. The RLS policy calls the `authorize` function:
  - The user's role is retrieved from the JWT.
  - The `role_permissions` table is checked to see if the user has permission to `SELECT` from `app_zones`.
  - The condition `$organization_id = (auth.jwt() ->> 'organization_id')::bigint` is evaluated with the actual `organization_id` from the JWT.
  - Access is granted if the condition evaluates to `true`.

---

## Custom Claims in JWT

The `custom_access_token_hook` function injects additional claims into the JWT, such as `user_role` and `organization_id`:
```plpgsql
claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
claims := jsonb_set(claims, '{organization_id}', to_jsonb(org_id));
```
These claims are used for subsequent authorization checks by calling `auth.jwt()`.

---

## Simplified Policy Structure: Four Policies Per Table

This system only requires four policies per table, one for each SQL operation:
1. **Select Policy**: Controls read access.
2. **Insert Policy**: Controls the ability to add new rows.
3. **Update Policy**: Controls the modification of rows.
4. **Delete Policy**: Controls row deletion.

### Role Permissions Conditions
Instead of defining multiple policies, the complexity of access control is managed via the `role_permissions` table and the `authorize` function.

**Example for `app_zones` Table**:
```sql
CREATE POLICY "app_zones_select" ON app_zones
    FOR SELECT TO authenticated
    USING (
      authorize(
        'app_zones'::text,
        'select'::text,
        json_build_object('$id', app_zones.id, '$organization_id', app_zones.organization_id)::jsonb
      )
    );
```

### How It Works
- **Authorization Logic**: The `authorize` function dynamically evaluates whether the user can perform the action, based on the user's role and conditions stored in the `role_permissions` table.
- **Flexibility**: This setup allows the same four policies to cover multiple roles, actions, and context-specific conditions.

---

## Considerations and Criticisms

### 1. **Complexity in `authorize` Function**
Centralizing logic in the `authorize` function introduces complexity. Dynamic SQL conditions are evaluated on the fly, making the system harder to audit and debug.

### 2. **Performance Concerns**
Dynamic SQL execution introduces overhead, particularly in high-traffic environments. Incorrectly formatted conditions can also lead to unintended access control behavior.

### 3. **Maintenance Challenges**
Updating conditions requires changes in the `role_permissions` table and may necessitate modifications to the `authorize` function. This adds complexity as the system grows.

### 4. **Scalability and Readability**
As roles and resources increase, the `role_permissions` table may become large, making it harder to manage and audit. Dynamic conditions may reduce readability.

### 5. **Security Risks**
Parameter substitution must be handled carefully to avoid SQL injection and ensure correct privilege checks.

---

## Conclusion

This approach of handling RLS with dynamic RBAC is efficient in terms of reducing the number of policies required but introduces complexity in terms of maintainability and performance. The success of this system hinges on careful design, testing, and monitoring of the `authorize` function and `role_permissions` table.

---

## Summary

This setup dynamically enforces access control based on user roles and conditions stored in the database:
- **Dynamic SQL Conditions**: Conditional logic stored in the `role_permissions` table.
- **JWT-Based Role & Claims**: User roles and claims like `organization_id` are embedded in JWT tokens.
- **Row-Level Security (RLS)**: Policies enforce fine-grained access control at the row level.

---

## Development

Run `ng serve` for a development server. Navigate to `http://localhost:4200/`. The application will reload on source file changes.

## Code Scaffolding

Run `ng generate component component-name` to create a new component, or use other `ng generate` commands for directives, services, and more.

## Build

Run `ng build` to compile the project. The build artifacts will be stored in the `dist/` directory.

## Running Unit Tests

Run `ng test` to execute unit tests using [Karma](https://karma-runner.github.io).

## Running End-to-End Tests

Run `ng e2e` for end-to-end tests. Ensure you have an appropriate package for testing capabilities.

## Further Help

For more help with the Angular CLI, use `ng help` or visit the [Angular CLI Overview and Command Reference](https://angular.io/cli).
