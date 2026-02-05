
import { Circle, Shape, Dimension, Point, Rectangle, DrawingState } from '../types';
import { getShapeBoundingBox } from './geometry';

type BoundingBox = { minX: number, minY: number, maxX: number, maxY: number };

const getDimensionBoundingBox = (dim: Dimension): BoundingBox => {
    const { p1, p2, offset } = dim;
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const perpAngle = angle + Math.PI / 2;
    const dx = Math.cos(perpAngle) * offset;
    const dy = Math.sin(perpAngle) * offset;
    
    const dimP1 = {x: p1.x + dx, y: p1.y + dy};
    const dimP2 = {x: p2.x + dx, y: p2.y + dy};

    const buffer = 10; 
    return {
        minX: Math.min(dimP1.x, dimP2.x) - buffer,
        minY: Math.min(dimP1.y, dimP2.y) - buffer,
        maxX: Math.max(dimP1.x, dimP2.x) + buffer,
        maxY: Math.max(dimP1.y, dimP2.y) + buffer,
    }
};

const doBoxesIntersect = (boxA: BoundingBox, boxB: BoundingBox): boolean => {
    return (
        boxA.minX <= boxB.maxX &&
        boxA.maxX >= boxB.minX &&
        boxA.minY <= boxB.maxY &&
        boxA.maxY >= boxB.minY
    );
};

const findOptimalOffset = (
    p1: Point,
    p2: Point,
    existingDimensions: Dimension[],
    initialOffset = 20,
    increment = 15
): number => {
    let offset = initialOffset;
    const maxAttempts = 20;

    for (let i = 0; i < maxAttempts; i++) {
        const tempDim: Dimension = { id: 'temp', layerId: 'dimensions', p1, p2, offset };
        const tempBox = getDimensionBoundingBox(tempDim);
        
        let hasCollision = false;
        for(const existingDim of existingDimensions) {
            const existingBox = getDimensionBoundingBox(existingDim);
            if (doBoxesIntersect(tempBox, existingBox)) {
                hasCollision = true;
                break;
            }
        }
        
        if (!hasCollision) {
            return offset;
        }
        
        offset = initialOffset > 0 ? offset + increment : offset - increment;
    }
    return offset;
};

const findNearestDimensionPoints = (center: Point, otherShapes: Shape[]): { hPoint: Point, vPoint: Point } => {
    if (otherShapes.length === 0) {
        return {
            hPoint: { x: 0, y: center.y },
            vPoint: { x: center.x, y: 0 }
        };
    }

    let minHDist = Infinity;
    let bestHPoint: Point | null = null;
    let minVDist = Infinity;
    let bestVPoint: Point | null = null;

    otherShapes.forEach(shape => {
        const bbox = getShapeBoundingBox(shape);
        // Horizontal check (find nearest vertical edge)
        let distToLeft = center.x - bbox.maxX;
        if (distToLeft >= 0 && distToLeft < minHDist) {
            minHDist = distToLeft;
            bestHPoint = { x: bbox.maxX, y: center.y };
        }
        let distToRight = bbox.minX - center.x;
        if (distToRight >= 0 && distToRight < minHDist) {
            minHDist = distToRight;
            bestHPoint = { x: bbox.minX, y: center.y };
        }

        // Vertical check (find nearest horizontal edge)
        let distToTop = center.y - bbox.maxY;
        if (distToTop >= 0 && distToTop < minVDist) {
            minVDist = distToTop;
            bestVPoint = { x: center.x, y: bbox.maxY };
        }
        let distToBottom = bbox.minY - center.y;
        if (distToBottom >= 0 && distToBottom < minVDist) {
            minVDist = distToBottom;
            bestVPoint = { x: center.x, y: bbox.minY };
        }
    });

    return {
        hPoint: bestHPoint || { x: 0, y: center.y },
        vPoint: bestVPoint || { x: center.x, y: 0 },
    };
};

export const autoDimensionCircle = (
    circle: Circle,
    allShapes: Shape[],
    allDimensions: Dimension[]
): Dimension[] => {
    const newDimensions: Dimension[] = [];
    const otherShapes = allShapes.filter(s => s.id !== circle.id);

    // 1. Diameter Dimension
    const diameterP1 = { x: circle.center.x, y: circle.center.y - circle.radius };
    const diameterP2 = { x: circle.center.x, y: circle.center.y + circle.radius };
    const diameterOffset = findOptimalOffset(
        diameterP1, 
        diameterP2,
        allDimensions,
        circle.radius + 20
    );
    const diameterDim: Dimension = {
        id: `dim-${Date.now()}-dia`,
        layerId: 'dimensions',
        p1: diameterP1,
        p2: diameterP2,
        offset: diameterOffset,
        text: `ø${(circle.radius * 2).toFixed(2)}`
    };
    newDimensions.push(diameterDim);

    // 2. Positional Dimensions
    const { hPoint, vPoint } = findNearestDimensionPoints(circle.center, otherShapes);

    const hOffset = findOptimalOffset( hPoint, { x: circle.center.x, y: hPoint.y }, [...allDimensions, ...newDimensions] );
    const hDim: Dimension = { id: `dim-${Date.now()}-h`, layerId: 'dimensions', p1: hPoint, p2: { x: circle.center.x, y: hPoint.y }, offset: hOffset };
    newDimensions.push(hDim);

    const vOffset = findOptimalOffset( vPoint, { x: vPoint.x, y: circle.center.y }, [...allDimensions, ...newDimensions] );
    const vDim: Dimension = { id: `dim-${Date.now()}-v`, layerId: 'dimensions', p1: vPoint, p2: { x: vPoint.x, y: circle.center.y }, offset: vOffset };
    newDimensions.push(vDim);

    return newDimensions;
};

export const autoDimensionRectangle = (
    rect: Rectangle,
    allShapes: Shape[],
    allDimensions: Dimension[]
): Dimension[] => {
    const newDimensions: Dimension[] = [];
    const otherShapes = allShapes.filter(s => s.id !== rect.id);

    const minX = Math.min(rect.p1.x, rect.p2.x);
    const minY = Math.min(rect.p1.y, rect.p2.y);
    const maxX = Math.max(rect.p1.x, rect.p2.x);
    const maxY = Math.max(rect.p1.y, rect.p2.y);

    const widthP1 = { x: minX, y: maxY }; const widthP2 = { x: maxX, y: maxY };
    const widthOffset = findOptimalOffset(widthP1, widthP2, allDimensions, 20);
    newDimensions.push({ id: `dim-${Date.now()}-w`, layerId: 'dimensions', p1: widthP1, p2: widthP2, offset: widthOffset });

    const heightP1 = { x: maxX, y: minY }; const heightP2 = { x: maxX, y: maxY };
    const heightOffset = findOptimalOffset(heightP1, heightP2, [...allDimensions, ...newDimensions], 20);
    newDimensions.push({ id: `dim-${Date.now()}-h`, layerId: 'dimensions', p1: heightP1, p2: heightP2, offset: heightOffset });

    const refPoint = { x: minX, y: minY };
    const { hPoint, vPoint } = findNearestDimensionPoints(refPoint, otherShapes);
    
    const hPosP1 = {x: hPoint.x, y: refPoint.y}; const hPosP2 = refPoint;
    const hPosOffset = findOptimalOffset(hPosP1, hPosP2, [...allDimensions, ...newDimensions], -20, -15);
    newDimensions.push({ id: `dim-${Date.now()}-hpos`, layerId: 'dimensions', p1: hPosP1, p2: hPosP2, offset: hPosOffset });

    const vPosP1 = {x: refPoint.x, y: vPoint.y}; const vPosP2 = refPoint;
    const vPosOffset = findOptimalOffset(vPosP1, vPosP2, [...allDimensions, ...newDimensions], -20, -15);
    newDimensions.push({ id: `dim-${Date.now()}-vpos`, layerId: 'dimensions', p1: vPosP1, p2: vPosP2, offset: vPosOffset });

    return newDimensions;
};

export const autoDimensionAll = (drawingState: DrawingState): Dimension[] => {
    const { shapes, dimensions } = drawingState;
    if (shapes.length === 0) return [];

    let newDimensions: Dimension[] = [];
    const currentAndNewDimensions = [...dimensions];

    // 1. Calculate global bounding box and key points
    const globalBbox = shapes.reduce((acc, shape) => {
        const sBbox = getShapeBoundingBox(shape);
        return {
            minX: Math.min(acc.minX, sBbox.minX),
            minY: Math.min(acc.minY, sBbox.minY),
            maxX: Math.max(acc.maxX, sBbox.maxX),
            maxY: Math.max(acc.maxY, sBbox.maxY),
        }
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    
    const keyPoints = shapes.flatMap(s => {
        if (s.type === 'circle') return [s.center];
        if (s.type === 'rectangle') {
            const rbox = getShapeBoundingBox(s);
            return [{x: rbox.minX, y: rbox.minY}, {x: rbox.maxX, y: rbox.maxY}];
        }
        if (s.type === 'line') return [s.p1, s.p2];
        return [];
    });
    const uniqueXCoords = [...new Set(keyPoints.map(p => p.x))].sort((a,b) => a-b);
    const uniqueYCoords = [...new Set(keyPoints.map(p => p.y))].sort((a,b) => a-b);

    const BASELINE_INITIAL_OFFSET = 25;
    const BASELINE_INCREMENT = 15;

    // 2. Add Baseline Dimensions in compact, predictable rows
    let yLevel = 0;
    uniqueXCoords.forEach(x => {
        if (x === globalBbox.minX) return; // Skip datum line
        const p1 = { x: globalBbox.minX, y: globalBbox.minY };
        const p2 = { x: x, y: globalBbox.minY };
        const offset = -(BASELINE_INITIAL_OFFSET + (yLevel * BASELINE_INCREMENT));
        const dim: Dimension = {id: `dim-pos-x-${x}`, layerId: 'dimensions', p1, p2, offset};
        newDimensions.push(dim);
        currentAndNewDimensions.push(dim);
        yLevel++;
    });

    let xLevel = 0;
    uniqueYCoords.forEach(y => {
        if (y === globalBbox.minY) return; // Skip datum line
        const p1 = { x: globalBbox.minX, y: globalBbox.minY };
        const p2 = { x: globalBbox.minX, y: y };
        const offset = -(BASELINE_INITIAL_OFFSET + (xLevel * BASELINE_INCREMENT));
        const dim: Dimension = {id: `dim-pos-y-${y}`, layerId: 'dimensions', p1, p2, offset};
        newDimensions.push(dim);
        currentAndNewDimensions.push(dim);
        xLevel++;
    });

    // 3. Add Overall Dimensions just outside the baseline dimensions
    const overallYOffset = -(BASELINE_INITIAL_OFFSET + (yLevel * BASELINE_INCREMENT));
    const overallWidthDim: Dimension = { id: `dim-overall-w`, layerId: 'dimensions', p1: {x: globalBbox.minX, y: globalBbox.minY}, p2: {x: globalBbox.maxX, y: globalBbox.minY}, offset: overallYOffset };
    newDimensions.push(overallWidthDim);
    currentAndNewDimensions.push(overallWidthDim);
    
    const overallXOffset = -(BASELINE_INITIAL_OFFSET + (xLevel * BASELINE_INCREMENT));
    const overallHeightDim: Dimension = { id: `dim-overall-h`, layerId: 'dimensions', p1: {x: globalBbox.minX, y: globalBbox.minY}, p2: {x: globalBbox.minX, y: globalBbox.maxY}, offset: overallXOffset };
    newDimensions.push(overallHeightDim);
    currentAndNewDimensions.push(overallHeightDim);

    // 4. Dimension individual features, using findOptimalOffset to place them neatly
    shapes.forEach(shape => {
        if (shape.type === 'circle') {
            const diameterP1 = { x: shape.center.x, y: shape.center.y - shape.radius };
            const diameterP2 = { x: shape.center.x, y: shape.center.y + shape.radius };
            const diameterOffset = findOptimalOffset(diameterP1, diameterP2, currentAndNewDimensions, shape.radius + 15, 10);
            const dim: Dimension = { id: `dim-${shape.id}-dia`, layerId: 'dimensions', p1: diameterP1, p2: diameterP2, offset: diameterOffset, text: `ø${(shape.radius * 2).toFixed(2)}` };
            newDimensions.push(dim);
            currentAndNewDimensions.push(dim);
        } else if (shape.type === 'rectangle') {
            const rbox = getShapeBoundingBox(shape);
            const wP1 = {x: rbox.minX, y: rbox.maxY}; const wP2 = {x: rbox.maxX, y: rbox.maxY};
            const wOffset = findOptimalOffset(wP1, wP2, currentAndNewDimensions, 15);
            const wDim: Dimension = {id: `dim-${shape.id}-w`, layerId:'dimensions', p1: wP1, p2: wP2, offset: wOffset};
            newDimensions.push(wDim);
            currentAndNewDimensions.push(wDim);

            const hP1 = {x: rbox.maxX, y: rbox.minY}; const hP2 = {x: rbox.maxX, y: rbox.maxY};
            const hOffset = findOptimalOffset(hP1, hP2, currentAndNewDimensions, 15);
            const hDim: Dimension = {id: `dim-${shape.id}-h`, layerId:'dimensions', p1: hP1, p2: hP2, offset: hOffset};
            newDimensions.push(hDim);
            currentAndNewDimensions.push(hDim);
        }
    });

    return newDimensions;
};
