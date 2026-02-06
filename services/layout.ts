
import { DrawingState, Annotation, TextAnnotation, LeaderAnnotation } from '../types';
import { getShapeBoundingBox, getDimensionGeometryBbox } from './geometry';

const getAnnotationBoundingBox = (annotation: Annotation): { minX: number, minY: number, maxX: number, maxY: number } => {
    if (annotation.type === 'text') {
        const textAnnot = annotation as TextAnnotation;
        // Przybliżony rozmiar tekstu (szerokość ~6px na znak, wysokość ~fontSize)
        const fontSize = textAnnot.fontSize || 14;
        const textWidth = textAnnot.text.length * fontSize * 0.6;
        const textHeight = fontSize;
        return {
            minX: textAnnot.position.x,
            minY: textAnnot.position.y - textHeight,
            maxX: textAnnot.position.x + textWidth,
            maxY: textAnnot.position.y,
        };
    } else if (annotation.type === 'leader') {
        const leader = annotation as LeaderAnnotation;
        const points = [leader.arrowPoint, leader.elbowPoint, leader.textPoint];
        // Dodaj margines na tekst
        const textWidth = leader.text.length * 8;
        return {
            minX: Math.min(...points.map(p => p.x)) - 5,
            minY: Math.min(...points.map(p => p.y)) - 15,
            maxX: Math.max(...points.map(p => p.x)) + textWidth,
            maxY: Math.max(...points.map(p => p.y)) + 5,
        };
    }
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
};

export const calculatePrintLayout = (
    drawingState: DrawingState,
    availableWidth: number,
    availableHeight: number,
    margin: number
) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const hasContent = drawingState.shapes.length > 0 || 
                     drawingState.dimensions.length > 0 || 
                     (drawingState.annotations && drawingState.annotations.length > 0);

  if (!hasContent) {
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
    if (drawingState.annotations) {
        drawingState.annotations.forEach(annot => {
            const bbox = getAnnotationBoundingBox(annot);
            minX = Math.min(minX, bbox.minX);
            minY = Math.min(minY, bbox.minY);
            maxX = Math.max(maxX, bbox.maxX);
            maxY = Math.max(maxY, bbox.maxY);
        });
    }
  }

  // Dodaj padding wokół rysunku
  const padding = 15;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  let drawingWidth = maxX - minX;
  let drawingHeight = maxY - minY;
  
  if (drawingWidth <= 1) drawingWidth = 1;
  if (drawingHeight <= 1) drawingHeight = 1;

  const drawingCenterX = minX + drawingWidth / 2;
  const drawingCenterY = minY + drawingHeight / 2;

  const scaleX = availableWidth / drawingWidth;
  const scaleY = availableHeight / drawingHeight;
  const finalScale = Math.min(scaleX, scaleY); 
  
  // Wyśrodkuj rysunek na stronie
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
