// Blueprint fog (plan 3.4): fog fill with the explored cells cut out, the hex grid of unexplored cells around `gridCell`,
// and a thin edge around the explored area. All in Standard's `middle` slot: above roads (they show faintly through the
// fog), under labels and 3D. Layers added after these WITHOUT a slot (route line) draw on top.
// memo: rnmapbox's ShapeSource stringifies its shape on every render, so this only re-renders when its inputs change
// (the HUD itself re-renders every second).
import { FillLayer, LineLayer, ShapeSource } from '@rnmapbox/maps';
import { cellToLatLng } from 'h3-js';
import { memo, useMemo } from 'react';

import { FOG, fogShapes, unexploredGrid, type Box } from '@/lib/fog';
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
  const { c } = useTheme();
  const shapes = useMemo(() => fogShapes(cells, box), [cells, box]);
  const grid = useMemo(() => {
    if (!gridCell) return EMPTY_FC;
    const [lat, lng] = cellToLatLng(gridCell);
    return unexploredGrid(lat, lng, FOG.gridRadius, cells);
  }, [gridCell, cells]);

  return (
    <>
      <ShapeSource id="fog" shape={shapes.fog}>
        <FillLayer id="fog-fill" slot="middle" style={{ fillColor: c.bg, fillOpacity: FOG.opacity }} />
      </ShapeSource>
      <ShapeSource id="fog-grid" shape={grid}>
        <LineLayer
          id="fog-grid-line"
          slot="middle"
          minZoomLevel={FOG.gridMinZoom}
          style={{ lineColor: c.muted, lineOpacity: 0.5, lineWidth: 0.7 }}
        />
      </ShapeSource>
      <ShapeSource id="explored-edge" shape={shapes.edges}>
        <LineLayer id="explored-edge-line" slot="middle" style={{ lineColor: c.primary, lineWidth: 1.5, lineOpacity: 0.8 }} />
      </ShapeSource>
    </>
  );
});
