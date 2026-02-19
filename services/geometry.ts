
import { Point, Shape, SnapPoint, SnapType, Dimension } from '../types';

export const getDistance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

export const pointToLineSegmentDistance = (p: Point, p1: Point, p2: Point): number => {
    const l2 = (p2.x - p1.x)**2 + (p2.y - p1.y)**2;
    if (l2 === 0) return getDistance(p, p1); // If line is a point
    let t = ((p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y)) / l2;
    t = Math.max(0, Math.min(1, t)); // Clamp t to the [0, 1] range
    const closestPoint = { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
    return getDistance(p, closestPoint);
};

export const getShapeBoundingBox = (shape: Shape): { minX: number, minY: number, maxX: number, maxY: number } => {
    switch(shape.type) {
        case 'line':
            return {
                minX: Math.min(shape.p1.x, shape.p2.x),
                minY: Math.min(shape.p1.y, shape.p2.y),
                maxX: Math.max(shape.p1.x, shape.p2.x),
                maxY: Math.max(shape.p1.y, shape.p2.y),
            };
        case 'circle':
            return {
                minX: shape.center.x - shape.radius,
                minY: shape.center.y - shape.radius,
                maxX: shape.center.x + shape.radius,
                maxY: shape.center.y + shape.radius,
            };
        case 'rectangle':
            return {
                minX: Math.min(shape.p1.x, shape.p2.x),
                minY: Math.min(shape.p1.y, shape.p2.y),
                maxX: Math.max(shape.p1.x, shape.p2.x),
                maxY: Math.max(shape.p1.y, shape.p2.y),
            };
    }
};

export const getDimensionGeometryBbox = (dim: Dimension): { minX: number, minY: number, maxX: number, maxY: number } => {
    const { p1, p2, offset } = dim;
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const perpAngle = angle + Math.PI / 2;
    const dx = Math.cos(perpAngle) * offset;
    const dy = Math.sin(perpAngle) * offset;
    
    const dimP1 = {x: p1.x + dx, y: p1.y + dy};
    const dimP2 = {x: p2.x + dx, y: p2.y + dy};

    const extLength = 15; // Should match drawing constant
    const textMargin = 20; // Margines na tekst wymiaru
    const extP1End = {x: p1.x + Math.cos(perpAngle)*(offset + extLength), y: p1.y + Math.sin(perpAngle)*(offset + extLength)};
    const extP2End = {x: p2.x + Math.cos(perpAngle)*(offset + extLength), y: p2.y + Math.sin(perpAngle)*(offset + extLength)};
    
    // Punkt środkowy linii wymiarowej z marginesem na tekst
    const midX = (dimP1.x + dimP2.x) / 2;
    const midY = (dimP1.y + dimP2.y) / 2;
    const textPoint1 = {x: midX + Math.cos(perpAngle) * textMargin, y: midY + Math.sin(perpAngle) * textMargin};
    const textPoint2 = {x: midX - Math.cos(perpAngle) * textMargin, y: midY - Math.sin(perpAngle) * textMargin};

    const points = [p1, p2, dimP1, dimP2, extP1End, extP2End, textPoint1, textPoint2];
    
    return points.reduce((acc, p) => ({
        minX: Math.min(acc.minX, p.x),
        minY: Math.min(acc.minY, p.y),
        maxX: Math.max(acc.maxX, p.x),
        maxY: Math.max(acc.maxY, p.y),
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
};


export const findSnapPoint = (
  cursor: Point,
  shapes: Shape[],
  snapDistance: number
): SnapPoint | null => {
  let bestSnap: SnapPoint | null = null;
  let minDistance = snapDistance;

  for (const shape of shapes) {
    let points: { point: Point; type: SnapType }[] = [];
    
    const getMidpoint = (p1: Point, p2: Point): Point => ({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });

    switch (shape.type) {
      case 'line':
        points.push({ point: shape.p1, type: 'endpoint' });
        points.push({ point: shape.p2, type: 'endpoint' });
        points.push({ point: getMidpoint(shape.p1, shape.p2), type: 'midpoint' });
        break;
      case 'circle':
        points.push({ point: shape.center, type: 'center' });
        const { center, radius } = shape;
        points.push({ point: {x: center.x + radius, y: center.y}, type: 'endpoint' });
        points.push({ point: {x: center.x - radius, y: center.y}, type: 'endpoint' });
        points.push({ point: {x: center.x, y: center.y + radius}, type: 'endpoint' });
        points.push({ point: {x: center.x, y: center.y - radius}, type: 'endpoint' });
        break;
      case 'rectangle':
        const { p1, p2 } = shape;
        const p3 = {x: p2.x, y: p1.y};
        const p4 = {x: p1.x, y: p2.y};
        points.push({ point: p1, type: 'endpoint' });
        points.push({ point: p2, type: 'endpoint' });
        points.push({ point: p3, type: 'endpoint' });
        points.push({ point: p4, type: 'endpoint' });
        points.push({ point: getMidpoint(p1,p3), type: 'midpoint'});
        points.push({ point: getMidpoint(p3,p2), type: 'midpoint'});
        points.push({ point: getMidpoint(p2,p4), type: 'midpoint'});
        points.push({ point: getMidpoint(p4,p1), type: 'midpoint'});
        points.push({ point: getMidpoint(p1,p2), type: 'center'});
        break;
    }

    for (const snap of points) {
      const distance = getDistance(cursor, snap.point);
      if (distance < minDistance) {
        minDistance = distance;
        bestSnap = snap;
      }
    }
  }
  return bestSnap;
};
