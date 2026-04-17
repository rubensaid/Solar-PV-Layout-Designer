/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  FileUp, 
  Settings2, 
  Zap, 
  Maximize2, 
  Layout, 
  Download, 
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PVMap from './components/PVMap';
import { parseKmlKmz, generateLayout } from './utils/geoUtils';
import type { PerimeterData, LayoutParams, PVLayoutResult } from './types';
import tokml from 'tokml';

export default function App() {
  const [perimeters, setPerimeters] = useState<PerimeterData[]>([]);
  const [layout, setLayout] = useState<PVLayoutResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [params, setParams] = useState<LayoutParams>({
    totalPowerLimitKW: 100000, // 100 MWp default
    panelConfig: {
      powerWp: 655,
      width: 1.134,
      height: 2.382,
      efficiency: 0.242,
    },
    tableConfig: {
      modulesHigh: 1,
      modulesWide: 28,
      horizontalGap: 0.02,
      verticalGap: 0.02,
    },
    pitch: 6.5,
    spacingBetweenTables: 0.4,
    azimuth: 0,
    roadWidthX: 12.0,
    roadWidthY: 8.0,
    tablesPerBlockX: 48,
    tablesPerBlockY: 8,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const data = await parseKmlKmz(file);
      if (data.length === 0) {
        throw new Error('No se encontraron polígonos válidos en el archivo.');
      }
      setPerimeters(data);
      // Reset layout when new perimeters are loaded
      setLayout(null);
    } catch (err: any) {
      setError(err.message || 'Error al procesar el archivo.');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = () => {
    if (perimeters.length === 0) return;
    setLoading(true);
    setTimeout(() => {
      try {
        const result = generateLayout(perimeters, params);
        setLayout(result);
      } catch (err: any) {
        setError('Error al generar el layout.');
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  const handleExport = () => {
    if (!layout) return;

    // Convert layout tables to a FeatureCollection
    const features = layout.tables.map(table => ({
      type: 'Feature',
      properties: {
        id: table.id,
        rotation: table.rotation,
        width: table.width,
        height: table.height,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [table.corners.map(c => [c[1], c[0]])] // [lon, lat]
      }
    }));

    const featureCollection = {
      type: 'FeatureCollection',
      features: features
    };

    // Convert to KML
    // @ts-ignore
    const kmlContent = tokml(featureCollection, {
      name: 'SolarLayout_Export',
      description: `Layout FV generado: ${(layout.stats.totalPowerKW / 1000).toFixed(2)} MWp`
    });

    // Create download link
    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SolarLayout_${(layout.stats.totalPowerKW / 1000).toFixed(0)}MWp.kml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="app-root" className="flex h-screen w-screen bg-[#0f1113] text-[#e0e0e0] overflow-hidden">
      {/* Sidebar */}
      <aside 
        id="sidebar" 
        className="w-80 bg-[#1a1d21] border-r border-[#2d3238] flex flex-col z-10"
      >
        <div className="h-[60px] flex items-center px-6 border-b border-[#2d3238]">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#00e676]" />
            <h1 className="text-sm font-bold tracking-[0.1em] uppercase">SolarLayout <span className="font-light opacity-50">Pro</span></h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Section: Input */}
          <section id="input-section" className="space-y-4">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#94a3b8]">
              Archivos Geográficos
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".kml,.kmz"
                onChange={handleFileUpload}
                className="hidden"
                id="kml-upload"
              />
              <label
                htmlFor="kml-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#2d3238] rounded-lg cursor-pointer hover:border-[#00e676] hover:bg-[#00e676]/5 transition-all text-center px-4"
              >
                <FileUp className="w-6 h-6 mb-2 opacity-30" />
                <span className="text-xs font-medium text-[#94a3b8]">
                  {perimeters.length > 0 ? `${perimeters.length} Perímetros cargados` : 'Arrastra archivos .KMZ o .KML'}
                </span>
                <span className="text-[10px] opacity-40 mt-1 uppercase tracking-tighter">(Máximo 10 polígonos)</span>
              </label>
            </div>
          </section>

          {/* Section: Config */}
          <section id="config-section" className="space-y-6">
            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#94a3b8]">Potencia (MWp)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10000"
                    max="500000"
                    step="5000"
                    value={params.totalPowerLimitKW}
                    onChange={(e) => setParams({ ...params, totalPowerLimitKW: Number(e.target.value) })}
                    className="flex-1 h-1 bg-[#2d3238] rounded-lg appearance-none cursor-pointer accent-[#00e676]"
                  />
                  <span className="text-xs font-mono min-w-[64px] text-right text-[#00e676]">
                    {(params.totalPowerLimitKW / 1000).toFixed(0)} MW
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-bold text-[#94a3b8]">Paso (m)</label>
                    <span className="text-[9px] text-[#00e676] font-mono">GCR ~{(params.panelConfig.height / params.pitch * 100).toFixed(1)}%</span>
                  </div>
                  <input
                    type="number"
                    value={params.pitch}
                    onChange={(e) => setParams({ ...params, pitch: Number(e.target.value) })}
                    className="w-full bg-[#121418] border border-[#2d3238] rounded px-3 py-2 text-sm font-mono focus:border-[#00e676] outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-bold text-[#94a3b8]">Azimut (°)</label>
                    <Info className="w-3 h-3 text-[#94a3b8]/50" title="0° = Norte (Ideal Peru)" />
                  </div>
                  <input
                    type="number"
                    value={params.azimuth}
                    onChange={(e) => setParams({ ...params, azimuth: Number(e.target.value) })}
                    className="w-full bg-[#121418] border border-[#2d3238] rounded px-3 py-2 text-sm font-mono focus:border-[#00e676] outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#2d3238] space-y-4">
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#94a3b8]">Sub-campos y Viales</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] uppercase font-bold text-[#94a3b8]">Viales N-S (m)</label>
                    <input
                      type="number"
                      value={params.roadWidthX}
                      onChange={(e) => setParams({ ...params, roadWidthX: Number(e.target.value) })}
                      className="w-full bg-[#121418] border border-[#2d3238] rounded px-3 py-2 text-sm font-mono focus:border-[#00e676] outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] uppercase font-bold text-[#94a3b8]">Viales E-W (m)</label>
                    <input
                      type="number"
                      value={params.roadWidthY}
                      onChange={(e) => setParams({ ...params, roadWidthY: Number(e.target.value) })}
                      className="w-full bg-[#121418] border border-[#2d3238] rounded px-3 py-2 text-sm font-mono focus:border-[#00e676] outline-none transition-colors"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] uppercase font-bold text-[#94a3b8]">Trackers x Bloque</label>
                    <input
                      type="number"
                      value={params.tablesPerBlockX}
                      onChange={(e) => setParams({ ...params, tablesPerBlockX: Number(e.target.value) })}
                      className="w-full bg-[#121418] border border-[#2d3238] rounded px-3 py-2 text-sm font-mono focus:border-[#00e676] outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] uppercase font-bold text-[#94a3b8]">Filas x Bloque</label>
                    <input
                      type="number"
                      value={params.tablesPerBlockY}
                      onChange={(e) => setParams({ ...params, tablesPerBlockY: Number(e.target.value) })}
                      className="w-full bg-[#121418] border border-[#2d3238] rounded px-3 py-2 text-sm font-mono focus:border-[#00e676] outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-[#121418] rounded-lg border border-[#2d3238]">
                <h4 className="text-[10px] font-bold uppercase tracking-tight flex items-center gap-1 text-[#00e676]">
                  <Settings2 className="w-3 h-3" /> Configuración Panel
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex justify-between items-center text-[10px] uppercase">
                    <span className="text-[#94a3b8]">Estandar</span>
                    <span className="font-mono">655 Wp</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] uppercase">
                    <span className="text-[#94a3b8]">Malla</span>
                    <span className="font-mono">1P x 28W</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <button
            id="calculate-btn"
            disabled={perimeters.length === 0 || loading}
            onClick={handleCalculate}
            className={`w-full py-4 rounded-lg font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2
              ${loading ? 'bg-white/10 text-white/20 cursor-wait' : 
                perimeters.length > 0 ? 'bg-[#00e676] text-[#000] hover:brightness-110 active:scale-[0.98]' : 
                'bg-[#2d3238] text-[#94a3b8] cursor-not-allowed'}`}
          >
            {loading ? 'Procesando...' : 'Generar Layout FV'}
            {!loading && <Layout className="w-4 h-4" />}
          </button>

          {error && (
            <div id="error-alert" className="p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded flex items-start gap-2 text-[10px] leading-tight">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Viewport */}
      <main id="main-viewport" className="flex-1 relative flex flex-col viewport-grid overflow-hidden">
        <header id="main-header" className="h-[60px] flex justify-between items-center px-6 bg-[#1a1d21]/50 backdrop-blur-md border-b border-[#2d3238]">
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 px-3 py-1 bg-[#2d3238] rounded-md">
                  <div className={`w-1.5 h-1.5 rounded-full ${perimeters.length > 0 ? 'bg-[#00e676] shadow-[0_0_8px_rgba(0,230,118,0.5)]' : 'bg-red-400'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                    {perimeters.length > 0 ? 'WGS84 Active' : 'Waiting...'}
                  </span>
               </div>
            </div>
            
            <div className="flex gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-[#2d3238] rounded-md text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                EPSG:4326
              </div>
              {layout && (
                <button 
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-1.5 bg-[#00e676] text-black rounded text-[10px] font-bold uppercase hover:brightness-110 transition-all shadow-lg"
                >
                  <Download className="w-3 h-3" /> Exportar
                </button>
              )}
            </div>
        </header>

        <div className="flex-1 relative">
          <PVMap perimeters={perimeters} layout={layout} />
          
          {/* Stats Bar Overlay */}
          <AnimatePresence>
            {layout && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="absolute bottom-6 left-6 right-6 h-20 bg-[#1a1d21]/95 border border-[#2d3238] rounded-xl flex items-center justify-around backdrop-blur-lg z-[1000] shadow-2xl"
              >
                <div className="text-center">
                  <span className="block font-mono text-xl font-bold text-[#00e676]">{(layout.stats.totalPowerKW / 1000).toFixed(2)} MWp</span>
                  <span className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest">Potencia Total</span>
                </div>
                <div className="w-[1px] h-8 bg-[#2d3238]" />
                <div className="text-center">
                  <span className="block font-mono text-xl font-bold text-[#00e676]">{Math.round(layout.stats.totalPanels).toLocaleString()}</span>
                  <span className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest">Número de Paneles</span>
                </div>
                <div className="w-[1px] h-8 bg-[#2d3238]" />
                <div className="text-center">
                  <span className="block font-mono text-xl font-bold text-[#00e676]">{layout.stats.areaHa.toFixed(2)} Ha</span>
                  <span className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest">Área Total</span>
                </div>
                <div className="w-[1px] h-8 bg-[#2d3238]" />
                <div className="text-center">
                  <span className="block font-mono text-xl font-bold text-[#00e676]">{(layout.stats.areaHa / (layout.stats.totalPowerKW / 1000)).toFixed(2)}</span>
                  <span className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest">Ratio Ha/MWp</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Overlay hints */}
          {!perimeters.length && (
            <div id="empty-state" className="absolute inset-0 z-[1000] bg-[#0f1113]/40 backdrop-blur-[2px] flex items-center justify-center flex-col text-center p-8 pointer-events-none">
              <div className="w-16 h-16 bg-[#1a1d21] border border-[#2d3238] rounded-full flex items-center justify-center mb-6 text-[#00e676] shadow-2xl">
                <Maximize2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-2 uppercase text-white">Configuración del Sitio</h3>
              <p className="max-w-xs text-xs text-[#94a3b8] leading-relaxed font-medium uppercase tracking-tighter opacity-70">
                Arrastre o suba un archivo de perímetro para iniciar el cálculo matemático de la planta.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
