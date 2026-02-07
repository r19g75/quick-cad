
import { Shape, Point, DrawingState, Line, Circle, Rectangle } from '../types';
import { getShapeBoundingBox } from './geometry';

const PROJECTION_GAP = 30; // Odstęp między widokami w mm

export interface ProjectionResult {
  shapes: Shape[];
  viewOffset: Point;
  viewLabel: string;
}

/**
 * Oblicza bounding box wszystkich kształtów
 */
const getGlobalBoundingBox = (shapes: Shape[]): { minX: number, minY: number, maxX: number, maxY: number, width: number, height: number } => {
  if (shapes.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
  }
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  shapes.forEach(shape => {
    const bbox = getShapeBoundingBox(shape);
    minX = Math.min(minX, bbox.minX);
    minY = Math.min(minY, bbox.minY);
    maxX = Math.max(maxX, bbox.maxX);
    maxY = Math.max(maxY, bbox.maxY);
  });
  
  return {
    minX, minY, maxX, maxY,
    width: maxX - minX,
    height: maxY - minY
  };
};

/**
 * Generuje widok z boku (Side View)
 * - Okrąg → prostokąt (średnica × głębokość)
 * - Prostokąt → prostokąt (wysokość × głębokość)
 * - Linia pozioma → linia
 * - Linia pionowa → prostokąt (długość × głębokość)
 */
export const generateSideView = (
  shapes: Shape[],
  depth: number,
  layerId: string = 'contour'
): ProjectionResult => {
  const globalBbox = getGlobalBoundingBox(shapes);
  const offsetX = globalBbox.maxX + PROJECTION_GAP;
  const projectedShapes: Shape[] = [];
  
  shapes.forEach((shape, index) => {
    const id = `proj-side-${Date.now()}-${index}`;
    
    if (shape.type === 'circle') {
      // Okrąg → prostokąt (średnica × głębokość)
      const diameter = shape.radius * 2;
      const topY = shape.center.y - shape.radius;
      
      projectedShapes.push({
        id,
        type: 'rectangle',
        layerId,
        p1: { x: offsetX, y: topY },
        p2: { x: offsetX + depth, y: topY + diameter }
      });
      
      // Dodaj linię środkową (oś)
      projectedShapes.push({
        id: `${id}-axis`,
        type: 'line',
        layerId: 'axes',
        p1: { x: offsetX - 5, y: shape.center.y },
        p2: { x: offsetX + depth + 5, y: shape.center.y }
      });
      
    } else if (shape.type === 'rectangle') {
      // Prostokąt → prostokąt (wysokość × głębokość)
      const bbox = getShapeBoundingBox(shape);
      
      projectedShapes.push({
        id,
        type: 'rectangle',
        layerId,
        p1: { x: offsetX, y: bbox.minY },
        p2: { x: offsetX + depth, y: bbox.maxY }
      });
      
    } else if (shape.type === 'line') {
      const bbox = getShapeBoundingBox(shape);
      const isHorizontal = Math.abs(shape.p1.y - shape.p2.y) < Math.abs(shape.p1.x - shape.p2.x);
      
      if (isHorizontal) {
        // Linia pozioma → linia pozioma (na tej samej wysokości)
        const avgY = (shape.p1.y + shape.p2.y) / 2;
        projectedShapes.push({
          id,
          type: 'line',
          layerId,
          p1: { x: offsetX, y: avgY },
          p2: { x: offsetX + depth, y: avgY }
        });
      } else {
        // Linia pionowa → prostokąt
        projectedShapes.push({
          id,
          type: 'rectangle',
          layerId,
          p1: { x: offsetX, y: bbox.minY },
          p2: { x: offsetX + depth, y: bbox.maxY }
        });
      }
    }
  });
  
  return {
    shapes: projectedShapes,
    viewOffset: { x: offsetX, y: globalBbox.minY },
    viewLabel: 'Side View'
  };
};

/**
 * Generuje widok z góry (Top View)
 * - Okrąg → prostokąt (średnica × głębokość)
 * - Prostokąt → prostokąt (szerokość × głębokość)
 * - Linia pionowa → linia
 * - Linia pozioma → prostokąt (długość × głębokość)
 */
export const generateTopView = (
  shapes: Shape[],
  depth: number,
  layerId: string = 'contour'
): ProjectionResult => {
  const globalBbox = getGlobalBoundingBox(shapes);
  const offsetY = globalBbox.maxY + PROJECTION_GAP;
  const projectedShapes: Shape[] = [];
  
  shapes.forEach((shape, index) => {
    const id = `proj-top-${Date.now()}-${index}`;
    
    if (shape.type === 'circle') {
      // Okrąg → prostokąt (średnica × głębokość)
      const diameter = shape.radius * 2;
      const leftX = shape.center.x - shape.radius;
      
      projectedShapes.push({
        id,
        type: 'rectangle',
        layerId,
        p1: { x: leftX, y: offsetY },
        p2: { x: leftX + diameter, y: offsetY + depth }
      });
      
      // Dodaj linię środkową (oś)
      projectedShapes.push({
        id: `${id}-axis`,
        type: 'line',
        layerId: 'axes',
        p1: { x: shape.center.x, y: offsetY - 5 },
        p2: { x: shape.center.x, y: offsetY + depth + 5 }
      });
      
    } else if (shape.type === 'rectangle') {
      // Prostokąt → prostokąt (szerokość × głębokość)
      const bbox = getShapeBoundingBox(shape);
      
      projectedShapes.push({
        id,
        type: 'rectangle',
        layerId,
        p1: { x: bbox.minX, y: offsetY },
        p2: { x: bbox.maxX, y: offsetY + depth }
      });
      
    } else if (shape.type === 'line') {
      const bbox = getShapeBoundingBox(shape);
      const isVertical = Math.abs(shape.p1.x - shape.p2.x) < Math.abs(shape.p1.y - shape.p2.y);
      
      if (isVertical) {
        // Linia pionowa → linia pionowa (na tej samej pozycji X)
        const avgX = (shape.p1.x + shape.p2.x) / 2;
        projectedShapes.push({
          id,
          type: 'line',
          layerId,
          p1: { x: avgX, y: offsetY },
          p2: { x: avgX, y: offsetY + depth }
        });
      } else {
        // Linia pozioma → prostokąt
        projectedShapes.push({
          id,
          type: 'rectangle',
          layerId,
          p1: { x: bbox.minX, y: offsetY },
          p2: { x: bbox.maxX, y: offsetY + depth }
        });
      }
    }
  });
  
  return {
    shapes: projectedShapes,
    viewOffset: { x: globalBbox.minX, y: offsetY },
    viewLabel: 'Top View'
  };
};

/**
 * Generuje wszystkie rzuty
 */
export const generateAllProjections = (
  shapes: Shape[],
  depth: number,
  layerId: string = 'contour'
): { sideView: ProjectionResult, topView: ProjectionResult } => {
  return {
    sideView: generateSideView(shapes, depth, layerId),
    topView: generateTopView(shapes, depth, layerId)
  };
};
