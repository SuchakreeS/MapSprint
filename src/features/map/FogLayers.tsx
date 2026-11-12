// Blueprint fog (plan 3.4): fog fill with the explored cells cut out, the hex grid of unexplored cells near `gridCenter`,
// and a thin yellow edge around the explored area. All in Standard's `middle` slot: above roads (they show faintly through
// the fog), under labels and 3D. Layers added after these WITHOUT a slot (route line) draw on top.
import { FillLayer, LineLayer, ShapeSource } from '@rnmapbox/maps';
import { latLngToCell } from 'h3-js';
import { useMemo } from 'react';

import { CELL_RES } from '@/lib/cells';
import { exploredEdges, FOG, fogFeature, unexploredGrid, type Box } from '@/lib/fog';
import { useTheme } from '@/theme/use-theme';

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function FogLayers({
  cells,
  box,
  gridCenter,
}: {
  cells: Set<string>;
  box: Box;
  gridCenter: { lat: number; lng: number } | null;
}) {
  const { c } = useTheme();
  const fog = useMemo(() => fogFeature(cells, box), [cells, box]);
  const edges = useMemo(() => exploredEdges(cells, box), [cells, box]);
  // Rebuild the grid only when the centre moves into another cell.
  const centreCell = gridCenter ? latLngToCell(gridCenter.lat, gridCenter.lng, CELL_RES) : null;
  const grid = useMemo(
    () => (gridCenter && centreCell ? unexploredGrid(gridCenter.lat, gridCenter.lng, FOG.gridRadius, cells) : EMPTY_FC),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the centre CELL, not every position update
    [centreCell, cells],
  );

  return (
    <>
      <ShapeSource id="fog" shape={fog}>
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
      <ShapeSource id="explored-edge" shape={edges}>
        <LineLayer id="explored-edge-line" slot="middle" style={{ lineColor: c.primary, lineWidth: 1.5, lineOpacity: 0.8 }} />
      </ShapeSource>
    </>
  );
}
