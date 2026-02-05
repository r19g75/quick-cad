
import { DrawingState } from '../types';
import { getShapeBoundingBox, getDimensionGeometryBbox } from './geometry';

export const calculatePrintLayout = (
    drawingState: DrawingState,
    availableWidth: number,
    availableHeight: number,
    margin: number
) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  if (drawingState.shapes.length === 0 && drawingState.dimensions.length === 0) {
      minX = 0; minY = 0; maxX = 100; maxY = 100;
  } else {
    drawingState.shapes.forEach(shape => {
        const bbox = getShapeBoundingBox(shape);
        minX = Math.min(minX, bbox.minX);
        minY = Math.min(minY, bbox.minY);
        maxX = Math.max(maxX, bbox.maxX);
        maxY = Math.max(maxY, bbox.maxY);
    });
    drawingState.dimensions.forEach(dim => {
        const bbox = getDimensionGeometryBbox(dim);
        minX = Math.min(minX, bbox.minX);
        minY = Math.min(minY, bbox.minY);
        maxX = Math.max(maxX, bbox.maxX);
        maxY = Math.max(maxY, bbox.maxY);
    });
  }

  let drawingWidth = maxX - minX;
  let drawingHeight = maxY - minY;
  
  if (drawingWidth <= 1) drawingWidth = 1;
  if (drawingHeight <= 1) drawingHeight = 1;

  const drawingCenterX = minX + drawingWidth / 2;
  const drawingCenterY = minY + drawingHeight / 2;

  const scaleX = availableWidth / drawingWidth;
  const scaleY = availableHeight / drawingHeight;
  const finalScale = Math.min(scaleX, scaleY); 
  
  const pageCenterX = margin + (availableWidth / 2);
  const pageCenterY = margin + (availableHeight / 2);

  const offsetX = pageCenterX - drawingCenterX * finalScale;
  const offsetY = pageCenterY - drawingCenterY * finalScale;

  return {
    finalScale,
    offsetX,
    offsetY,
    drawingBbox: { minX, minY, maxX, maxY }
  };
};
