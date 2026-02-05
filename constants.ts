
import { Layer } from './types';

export const GRID_SIZE = 10; // in mm
export const SNAP_DISTANCE = 10; // in pixels

export const LAYER_COLORS = {
  contour: '#ffffff',     // white
  dimensions: '#34d399', // emerald-400
  axes: '#f87171',       // red-400
  auxiliary: '#60a5fa',   // blue-400
};

export const INITIAL_LAYERS: Layer[] = [
  { id: 'contour', name: 'Contour', color: LAYER_COLORS.contour, visible: true, locked: false },
  { id: 'dimensions', name: 'Dimensions', color: LAYER_COLORS.dimensions, visible: true, locked: false },
  { id: 'axes', name: 'Axes', color: LAYER_COLORS.axes, visible: true, locked: false },
  { id: 'auxiliary', name: 'Auxiliary', color: LAYER_COLORS.auxiliary, visible: true, locked: false },
];
