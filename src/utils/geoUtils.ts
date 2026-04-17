/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as turf from '@turf/turf';
import { kml } from '@tmcw/togeojson';
import JSZip from 'jszip';
import proj4 from 'proj4';
import type { PerimeterData, LayoutParams, PVLayoutResult } from '../types';

/**
 * Parses a KML or KMZ file and returns an array of perimeters.
 */
export async function parseKmlKmz(file: File): Promise<PerimeterData[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  let kmlContent: string;

  if (extension === 'kmz') {
    const zip = await JSZip.loadAsync(file);
    const kmlFile = Object.values(zip.files).find((f) => f.name.endsWith('.kml'));
    if (!kmlFile) throw new Error('No KML found in KMZ');
    kmlContent = await kmlFile.async('text');
  } else {
    kmlContent = await file.text();
  }

  const parser = new DOMParser();
  const kmlDoc = parser.parseFromString(kmlContent, 'text/xml');
  const geojson = kml(kmlDoc);

  const perimeters: PerimeterData[] = [];

  turf.featureEach(geojson, (feature) => {
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      perimeters.push({
        name: (feature.properties?.name as string) || `Perímetro ${perimeters.length + 1}`,
        geojson: feature as any,
      });
    }
  });

  return perimeters;
}

/**
 * Calculates a local projection for the given center coordinates.
 * Returns a proj4 instance.
 */
function getLocalProjection(centerLon: number, centerLat: number) {
  const zone = Math.floor((centerLon + 180) / 6) + 1;
  const isSouth = centerLat < 0;
  const utmCode = `+proj=utm +zone=${zone} ${isSouth ? '+south ' : ''}+datum=WGS84 +units=m +no_defs`;
  return {
    fromWgs84: (coords: [number, number]): [number, number] => proj4('EPSG:4326', utmCode, coords),
    toWgs84: (coords: [number, number]): [number, number] => proj4(utmCode, 'EPSG:4326', coords),
  };
}

/**
 * Generates the PV layout within the provided perimeters.
 */
export function generateLayout(
  perimeters: PerimeterData[],
  params: LayoutParams
): PVLayoutResult {
  const tables: PVLayoutResult['tables'] = [];
  let currentPowerKW = 0;

  // Calculate table dimensions
  const tableWidth = params.tableConfig.modulesWide * params.panelConfig.width + 
                     (params.tableConfig.modulesWide - 1) * params.tableConfig.horizontalGap;
  const tableHeight = params.tableConfig.modulesHigh * params.panelConfig.height + 
                      (params.tableConfig.modulesHigh - 1) * params.tableConfig.verticalGap;

  const tablePowerKW = (params.tableConfig.modulesWide * params.tableConfig.modulesHigh * params.panelConfig.powerWp) / 1000;

  for (const perimeter of perimeters) {
    if (currentPowerKW >= params.totalPowerLimitKW) break;

    const bbox = turf.bbox(perimeter.geojson);
    const center = turf.center(perimeter.geojson);
    const [centerLon, centerLat] = center.geometry.coordinates;

    const proj = getLocalProjection(centerLon, centerLat);

    // Project perimeter to local meters
    const projectedPerimeter = turf.clone(perimeter.geojson);
    turf.coordEach(projectedPerimeter, (coord) => {
      const [lon, lat] = coord as [number, number];
      const [x, y] = proj.fromWgs84([lon, lat]);
      coord[0] = x;
      coord[1] = y;
    });

    const pBbox = turf.bbox(projectedPerimeter); // [minX, minY, maxX, maxY]
    const [minX, minY, maxX, maxY] = pBbox;

    // Iterate through grid in local project coordinates
    // FOR HSAT (N-S axis): stepX is pitch, stepY is table dimension + spacing
    const stepX = params.pitch;
    const stepY = tableWidth + params.spacingBetweenTables;

    // We expand the bounding box to account for rotation coverage
    const diag = Math.sqrt(Math.pow(maxX - minX, 2) + Math.pow(maxY - minY, 2));
    const gridMinX = (minX + maxX) / 2 - diag / 2;
    const gridMaxX = (minX + maxX) / 2 + diag / 2;
    const gridMinY = (minY + maxY) / 2 - diag / 2;
    const gridMaxY = (minY + maxY) / 2 + diag / 2;

    for (let y = gridMinY; y < gridMaxY; y += stepY) {
      if (currentPowerKW >= params.totalPowerLimitKW) break;
      for (let x = gridMinX; x < gridMaxX; x += stepX) {
        if (currentPowerKW >= params.totalPowerLimitKW) break;

        // Define table corners in local coordinates (unrotated)
        const localCorners: [number, number][] = [
          [-tableWidth / 2, -tableHeight / 2],
          [tableWidth / 2, -tableHeight / 2],
          [tableWidth / 2, tableHeight / 2],
          [-tableWidth / 2, tableHeight / 2],
          [-tableWidth / 2, -tableHeight / 2],
        ];

        // Rotate corners by azimuth (centered at current x, y)
        const angleRad = (params.azimuth * Math.PI) / 180;
        const rotatedCorners = localCorners.map(([cx, cy]) => {
          const rx = cx * Math.cos(angleRad) - cy * Math.sin(angleRad);
          const ry = cx * Math.sin(angleRad) + cy * Math.cos(angleRad);
          return [rx + x, ry + y];
        });

        const tablePoly = turf.polygon([rotatedCorners]);
        
        // Use booleanPointInPolygon on corners to be slightly more forgiving than booleanContains
        // which can fail due to precision issues on large coordinates.
        // Actually, for professional layouts, we check if center is inside and then all corners
        const isInside = rotatedCorners.every(c => turf.booleanPointInPolygon(c, projectedPerimeter));

        if (isInside) {
          // Convert back to WGS84
          const wgs84Corners = rotatedCorners.map(c => proj.toWgs84(c as [number, number]));
          const wgs84Center = proj.toWgs84([x, y]);

          tables.push({
            id: `table-${tables.length}`,
            center: [wgs84Center[1], wgs84Center[0]], // [lat, lon]
            corners: wgs84Corners.map(c => [c[1], c[0]]),
            width: tableWidth,
            height: tableHeight,
            rotation: params.azimuth,
          });

          currentPowerKW += tablePowerKW;
        }
      }
    }
  }

  const totalAreaM2 = perimeters.reduce((acc, p) => acc + turf.area(p.geojson), 0);

  return {
    tables,
    stats: {
      totalPanels: (currentPowerKW * 1000) / params.panelConfig.powerWp,
      totalPowerKW: currentPowerKW,
      areaHa: totalAreaM2 / 10000,
      utilizationPercent: (tables.length * tableWidth * tableHeight) / totalAreaM2 * 100,
    },
  };
}
