/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Feature, Polygon, MultiPolygon } from 'geojson';

export interface PVPanelConfig {
  powerWp: number;
  width: number; // meters
  height: number; // meters
  efficiency: number;
}

export interface PVTableConfig {
  modulesHigh: number;
  modulesWide: number;
  horizontalGap: number; // Gap between modules in a row
  verticalGap: number; // Gap between modules in a column
}

export interface LayoutParams {
  totalPowerLimitKW: number;
  panelConfig: PVPanelConfig;
  tableConfig: PVTableConfig;
  pitch: number; // Distance between rows (meters)
  spacingBetweenTables: number; // Lateral distance between tables in a row (meters)
  azimuth: number; // Orientation (degrees, 0 = North, 180 = South)
  roadWidthX: number; // Vertical road width between blocks (meters)
  roadWidthY: number; // Horizontal road width between blocks (meters)
  tablesPerBlockX: number; // Number of tables per block horizontally
  tablesPerBlockY: number; // Number of tables per block vertically
}

export interface PVLayoutResult {
  tables: {
    id: string;
    center: [number, number]; // [lat, lon]
    corners: [number, number][]; // [[lat, lon], ...]
    width: number;
    height: number;
    rotation: number;
  }[];
  stats: {
    totalPanels: number;
    totalPowerKW: number;
    areaHa: number;
    utilizationPercent: number;
  };
}

export interface PerimeterData {
  name: string;
  geojson: Feature<Polygon | MultiPolygon>;
}
