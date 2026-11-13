// Blueprint fog (plan 3.4): fog fill with the explored cells cut out, the hex grid of unexplored cells around `gridCell`,
// and a line around the explored area (dark: solid edge over a soft glow, wider zoomed out). All in Standard's `middle` slot:
// above roads (they show faintly through the fog), under labels and 3D.
// Layers added after these WITHOUT a slot (route line) draw on top. Look values per theme live in FOG (src/lib/fog.ts).
// memo: rnmapbox's ShapeSource stringifies its shape on every render, so this only re-renders when its inputs change
// (the HUD itself re-renders every second).
import { FillLayer, LineLayer, ShapeSource } from '@rnmapbox/maps';
import { cellToLatLng } from 'h3-js';
import { memo, useMemo } from 'react';

import { FOG, fogShapes, fogStyleFor, unexploredGrid, zoomWidth, type Box } from '@/lib/fog';
import { useTheme } from '@/theme/use-theme';

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export const FogLayers = memo(function FogLayers({
  cells,
  box,
  gridCell,
}: {
  cells: Set<string>;
  box: Box;
  /** H3 cell at the centre of the hex grid (pass a cell, not a position, so moving inside one cell changes nothing). */
  gridCell: string | null;
}) {
  const { mode, c } = useTheme();
  const f = fogStyleFor(mode);
  const shapes = useMemo(() => fogShapes(cells, box), [cells, box]);
  const grid = useMemo(() => {
    if (!gridCell) return EMPTY_FC;
    const [lat, lng] = cellToLatLng(gridCell);
    return unexploredGrid(lat, lng, FOG.gridRadius, cells);
  }, [gridCell, cells]);

  return (
    <>
      <ShapeSource id="fog" shape={shapes.fog}>
        <FillLayer id="fog-fill" slot="middle" style={{ fillColor: c.bg, fillOpacity: f.opacity }} />
      </ShapeSource>
      <ShapeSource id="fog-grid" shape={grid}>
        <LineLayer
          id="fog-grid-line"
          slot="middle"
          minZoomLevel={FOG.gridMinZoom}
          style={{ lineColor: c[f.grid.color], lineOpacity: f.grid.opacity, lineWidth: f.grid.width }}
        />
      </ShapeSource>
      {f.glow && (
        // Same shape as the edge, drawn first so it sits underneath (ShapeSource children must be elements, hence its own source).
        <ShapeSource id="explored-glow" shape={shapes.edges}>
          <LineLayer
            id="explored-edge-glow"
            slot="middle"
            style={{
              lineColor: c[f.glow.color],
              lineOpacity: f.glow.opacity,
              lineWidth: zoomWidth(f.glow.width) as never,
              lineBlur: f.glow.blur,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </ShapeSource>
      )}
      <ShapeSource id="explored-edge" shape={shapes.edges}>
        <LineLayer
          id="explored-edge-line"
          slot="middle"
          style={{
            lineColor: c[f.edge.color],
            lineWidth: zoomWidth(f.edge.width) as never,
            lineOpacity: f.edge.opacity,
            ...(f.glow ? { lineCap: 'round', lineJoin: 'round' } : {}),
          }}
        />
      </ShapeSource>
    </>
  );
});
