/**
 * Types miroirs du crate Rust `vyn-manifest`.
 * Utilisés par la CLI, le SDK et l'app desktop pour valider/typer les manifests.
 */

export const CURRENT_SCHEMA = 1 as const;

export interface Manifest {
  schema: typeof CURRENT_SCHEMA;
  id: string;
  name: string;
  version: string;
  author: Author;
  description?: string;
  icon?: string;
  size: GridSize;
  size_constraints?: SizeConstraints;
  permissions?: Permissions;
  network?: NetworkPolicy;
  entry?: string;
}

export interface Author {
  name: string;
  email?: string;
  url?: string;
}

export interface GridSize {
  w: number;
  h: number;
}

export interface SizeConstraints {
  min: GridSize;
  max: GridSize;
}

export interface Permissions {
  system?: boolean;
  media?: boolean;
  launcher?: boolean;
  storage?: boolean;
  ui_effects?: boolean;
  network?: boolean;
}

export interface NetworkPolicy {
  allow?: string[];
}

const ID_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+){1,}$/;

export function isValidId(id: string): boolean {
  return ID_PATTERN.test(id);
}
