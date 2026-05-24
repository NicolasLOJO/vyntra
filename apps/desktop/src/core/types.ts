export type ConfigFieldType = "string" | "number" | "boolean" | "select" | "color";

export interface ConfigField {
  label: string;
  type: ConfigFieldType;
  description?: string;
  default?: unknown;
  min?: number;
  max?: number;
  options?: string[];
}

export interface WidgetPermissions {
  system?: boolean;
  media?: boolean;
  launcher?: boolean;
  storage?: boolean;
  ui_effects?: boolean;
  network?: boolean;
}

export interface WidgetSummary {
  id: string;
  name: string;
  display_name?: string;
  version: string;
  size_w: number;
  size_h: number;
  permissions: WidgetPermissions;
  visible: boolean;
  config_schema: Record<string, ConfigField>;
  interactive?: boolean;
}

export interface GridPosition {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Monitor index (0 = primary). */
  monitor?: number;
}
