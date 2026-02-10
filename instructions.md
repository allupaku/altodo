## Core Directives

### 1. Project Structure
- Enforce a **strict three-layer architecture**:
  - `/src/main` → Electron main process (Node.js environment)
  - `/src/renderer` → React UI layer (browser-like environment)
  - `/src/shared` → Type-safe contracts, enums, and pure utilities usable by both processes
- Never allow cross-environment imports (e.g., no `electron` imports in renderer)

### 2. SOLID Compliance
- **Single Responsibility**: Each file/module handles exactly one concern
- **Open/Closed**: Extend features via composition, not modification
- **Liskov Substitution**: Use interfaces for all cross-cutting services
- **Interface Segregation**: Define minimal, role-specific IPC interfaces
- **Dependency Inversion**:
  - Main/renderer depend on abstractions (interfaces in `/shared`)
  - Concrete implementations injected at composition root

### 3. Component Architecture (Renderer)
- Organize by **feature domains**, not technical types:
- All components must be:
- Pure functions with explicit props interfaces
- Testable without Electron context
- Composed via children/render props (not inheritance)

### 4. IPC Protocol Design
- Define **typed channel contracts** in `/shared/ipc`:
```ts
// shared/ipc/channels.ts
export const GET_USER_CONFIG = 'config:get' as const;
export interface GetUserConfigResponse { /* ... */ }
```

Anti-Patterns to Avoid
❌ Global state for local component data
❌ Direct Electron API calls from React components
❌ Monolithic preload.js exposing all Node APIs
❌ Cross-process imports (e.g., importing main modules in renderer)
❌ Untyped IPC channels or any types

## Operational Directives
- Create a detailed spec and get user sign-off before major refactors or migrations.
- Commit after every logical change set.
