/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapContainer, TileLayer, Polygon, useMap, GeoJSON, LayersControl } from 'react-leaflet';

const { BaseLayer } = LayersControl;
import type { PerimeterData, PVLayoutResult } from '../types';
import L from 'leaflet';
import { useEffect } from 'react';

interface PVMapProps {
  perimeters: PerimeterData[];
  layout: PVLayoutResult | null;
}

function MapUpdater({ perimeters }: { perimeters: PerimeterData[] }) {
  const map = useMap();

  useEffect(() => {
    if (perimeters.length > 0) {
      const bounds = L.geoJSON(perimeters.map(p => p.geojson)).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [perimeters, map]);

  return null;
}

export default function PVMap({ perimeters, layout }: PVMapProps) {
  const center: [number, number] = perimeters.length > 0 
    ? [perimeters[0].geojson.geometry.type === 'Polygon' 
        ? perimeters[0].geojson.geometry.coordinates[0][0][1] 
        : perimeters[0].geojson.geometry.coordinates[0][0][0][1], 
       perimeters[0].geojson.geometry.type === 'Polygon' 
        ? perimeters[0].geojson.geometry.coordinates[0][0][0] 
        : perimeters[0].geojson.geometry.coordinates[0][0][0][0]
      ]
    : [-12.046374, -77.042793]; // Default to Lima, Peru for demo

  return (
    <div id="map-container" className="h-full w-full relative overflow-hidden rounded-xl border border-black/10 shadow-sm">
      <MapContainer
        center={center}
        zoom={13}
        className="h-full w-full"
        preferCanvas={true}
      >
        <LayersControl position="topright">
          <BaseLayer name="Calles (OSM)">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          </BaseLayer>
          <BaseLayer checked name="Satélite (Esri)">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </BaseLayer>
        </LayersControl>
        
        {/* Perimeters */}
        {perimeters.map((p, idx) => (
          <GeoJSON
            key={p.name + idx}
            data={p.geojson}
            style={{
              color: '#94a3b8',
              weight: 2,
              fillColor: '#94a3b8',
              fillOpacity: 0.1,
              dashArray: '4, 8'
            }}
          />
        ))}

        {/* PV Tables */}
        {layout?.tables.map((table) => (
          <Polygon
            key={table.id}
            positions={table.corners}
            pathOptions={{
              color: '#00e676',
              weight: 1,
              fillColor: '#00e676',
              fillOpacity: 0.8
            }}
          >
            {/* You could add a Popup here if needed */}
          </Polygon>
        ))}

        <MapUpdater perimeters={perimeters} />
      </MapContainer>
    </div>
  );
}
