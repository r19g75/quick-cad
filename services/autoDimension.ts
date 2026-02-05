import { Circle, Shape, Dimension, Point, Rectangle, DrawingState, Line } from '../types';
import { getShapeBoundingBox } from './geometry';

// Styl wymiarowania
export type DimensionStyle = 'auto' | 'shapes-only' | 'full';

type BoundingBox = { minX: number; minY: number; maxX: number; maxY: number };

// ============== POMOCNICZE ==============

const getDimensionBoundingBox = (dim: Dimension): BoundingBox => {
    const { p1, p2, offset } = dim;
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const perpAngle = angle + Math.PI / 2;
    const dx = Math.cos(perpAngle) * offset;
    const dy = Math.sin(perpAngle) * offset;

    const dimP1 = { x: p1.x + dx, y: p1.y + dy };
    const dimP2 = { x: p2.x + dx, y: p2.y + dy };

    const buffer = 12;
    return {
        minX: Math.min(dimP1.x, dimP2.x) - buffer,
        minY: Math.min(dimP1.y, dimP2.y) - buffer,
        maxX: Math.max(dimP1.x, dimP2.x) + buffer,
        maxY: Math.max(dimP1.y, dimP2.y) + buffer,
    };
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
    initialOffset = 25,
    increment = 18
): number => {
    let offset = initialOffset;
    const maxAttempts = 15;

    for (let i = 0; i < maxAttempts; i++) {
        const tempDim: Dimension = { id: 'temp', layerId: 'dimensions', p1, p2, offset };
        const tempBox = getDimensionBoundingBox(tempDim);

        let hasCollision = false;
        for (const existingDim of existingDimensions) {
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

const generateId = (prefix: string): string => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
};

// ============== WYKRYWANIE KONTURU ==============

const findOuterContour = (shapes: Shape[]): Rectangle | null => {
    // Szukamy największego prostokąta który może być konturem detalu
    const rectangles = shapes.filter((s): s is Rectangle => s.type === 'rectangle');
    if (rectangles.length === 0) return null;

    let largestRect: Rectangle | null = null;
    let largestArea = 0;

    for (const rect of rectangles) {
        const bbox = getShapeBoundingBox(rect);
        const area = (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY);
        if (area > largestArea) {
            largestArea = area;
            largestRect = rect;
        }
    }

    return largestRect;
};

const isShapeInsideContour = (shape: Shape, contour: Rectangle): boolean => {
    if (shape.id === contour.id) return false;

    const contourBbox = getShapeBoundingBox(contour);
    const shapeBbox = getShapeBoundingBox(shape);

    // Sprawdzamy czy kształt jest w całości wewnątrz konturu (z małym marginesem)
    const margin = 1;
    return (
        shapeBbox.minX >= contourBbox.minX - margin &&
        shapeBbox.maxX <= contourBbox.maxX + margin &&
        shapeBbox.minY >= contourBbox.minY - margin &&
        shapeBbox.maxY <= contourBbox.maxY + margin
    );
};

// ============== WYMIARY KSZTAŁTÓW ==============

const createCircleDiameterDimension = (
    circle: Circle,
    existingDimensions: Dimension[]
): Dimension => {
    // Wymiar średnicy - zawsze poziomy, z prawej strony koła
    const p1: Point = { x: circle.center.x - circle.radius, y: circle.center.y };
    const p2: Point = { x: circle.center.x + circle.radius, y: circle.center.y };
    
    const offset = findOptimalOffset(p1, p2, existingDimensions, circle.radius + 20, 15);

    return {
        id: generateId('dim-dia'),
        layerId: 'dimensions',
        p1,
        p2,
        offset,
        text: `ø${(circle.radius * 2).toFixed(1)}`,
    };
};

// Dedykowana funkcja dla wymiarów konturu - zawsze na zewnątrz, stałe pozycje
const createContourDimensions = (
    rect: Rectangle,
    existingDimensions: Dimension[]
): Dimension[] => {
    const dims: Dimension[] = [];
    const bbox = getShapeBoundingBox(rect);
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;

    // Wymiar szerokości - NA GÓRZE konturu (offset dodatni)
    const widthP1 = { x: bbox.minX, y: bbox.maxY };
    const widthP2 = { x: bbox.maxX, y: bbox.maxY };
    dims.push({
        id: generateId('dim-contour-w'),
        layerId: 'dimensions',
        p1: widthP1,
        p2: widthP2,
        offset: 25, // stały offset na górze
        text: width.toFixed(1),
    });

    // Wymiar wysokości - Z PRAWEJ strony konturu (offset dodatni)
    const heightP1 = { x: bbox.maxX, y: bbox.minY };
    const heightP2 = { x: bbox.maxX, y: bbox.maxY };
    dims.push({
        id: generateId('dim-contour-h'),
        layerId: 'dimensions',
        p1: heightP1,
        p2: heightP2,
        offset: 25, // stały offset z prawej
        text: height.toFixed(1),
    });

    return dims;
};

const createRectangleDimensions = (
    rect: Rectangle,
    existingDimensions: Dimension[]
): Dimension[] => {
    const dims: Dimension[] = [];
    const bbox = getShapeBoundingBox(rect);
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;

    // Wymiar szerokości - na dole
    const widthP1 = { x: bbox.minX, y: bbox.minY };
    const widthP2 = { x: bbox.maxX, y: bbox.minY };
    const widthOffset = findOptimalOffset(widthP1, widthP2, existingDimensions, -25, -18);
    dims.push({
        id: generateId('dim-w'),
        layerId: 'dimensions',
        p1: widthP1,
        p2: widthP2,
        offset: widthOffset,
        text: width.toFixed(1),
    });

    // Wymiar wysokości - z lewej strony
    const heightP1 = { x: bbox.minX, y: bbox.minY };
    const heightP2 = { x: bbox.minX, y: bbox.maxY };
    const heightOffset = findOptimalOffset(heightP1, heightP2, [...existingDimensions, ...dims], -25, -18);
    dims.push({
        id: generateId('dim-h'),
        layerId: 'dimensions',
        p1: heightP1,
        p2: heightP2,
        offset: heightOffset,
        text: height.toFixed(1),
    });

    return dims;
};

// ============== WYMIARY POZYCYJNE ==============

// Zbiera wszystkie wymiary pozycyjne dla kształtów wewnątrz konturu
const createAllPositionalDimensions = (
    innerShapes: Shape[],
    basePoint: Point,
    contourBbox: BoundingBox,
    existingDimensions: Dimension[]
): Dimension[] => {
    const dims: Dimension[] = [];
    
    // Zbierz punkty referencyjne dla wszystkich kształtów
    const refPoints: { shape: Shape; point: Point }[] = [];
    for (const shape of innerShapes) {
        if (shape.type === 'circle') {
            refPoints.push({ shape, point: shape.center });
        } else {
            const bbox = getShapeBoundingBox(shape);
            refPoints.push({ shape, point: { x: bbox.minX, y: bbox.minY } });
        }
    }

    // Sortuj punkty po X dla wymiarów poziomych
    const sortedByX = [...refPoints].sort((a, b) => a.point.x - b.point.x);
    
    // Sortuj punkty po Y dla wymiarów pionowych
    const sortedByY = [...refPoints].sort((a, b) => a.point.y - b.point.y);

    // Wymiary poziome (X) - na dole konturu, w uporządkowanych rzędach
    const baseY = contourBbox.minY;
    let xDimLevel = 0;
    const X_DIM_START = -30;
    const X_DIM_INCREMENT = -22;

    for (const { point } of sortedByX) {
        const deltaX = point.x - basePoint.x;
        if (Math.abs(deltaX) < 0.1) continue;

        const offset = X_DIM_START + (xDimLevel * X_DIM_INCREMENT);
        dims.push({
            id: generateId('dim-pos-x'),
            layerId: 'dimensions',
            p1: { x: basePoint.x, y: baseY },
            p2: { x: point.x, y: baseY },
            offset,
            text: deltaX.toFixed(1),
        });
        xDimLevel++;
    }

    // Wymiary pionowe (Y) - z lewej strony konturu, w uporządkowanych rzędach
    const baseX = contourBbox.minX;
    let yDimLevel = 0;
    const Y_DIM_START = -30;
    const Y_DIM_INCREMENT = -22;

    for (const { point } of sortedByY) {
        const deltaY = point.y - basePoint.y;
        if (Math.abs(deltaY) < 0.1) continue;

        const offset = Y_DIM_START + (yDimLevel * Y_DIM_INCREMENT);
        dims.push({
            id: generateId('dim-pos-y'),
            layerId: 'dimensions',
            p1: { x: baseX, y: basePoint.y },
            p2: { x: baseX, y: point.y },
            offset,
            text: deltaY.toFixed(1),
        });
        yDimLevel++;
    }

    return dims;
};

// Stara funkcja - używana dla pojedynczych kształtów
const createPositionalDimensions = (
    shape: Shape,
    basePoint: Point,
    existingDimensions: Dimension[]
): Dimension[] => {
    const dims: Dimension[] = [];
    const shapeBbox = getShapeBoundingBox(shape);

    // Punkt referencyjny kształtu
    let refPoint: Point;
    if (shape.type === 'circle') {
        refPoint = shape.center;
    } else {
        // Dla prostokątów - lewy dolny róg
        refPoint = { x: shapeBbox.minX, y: shapeBbox.minY };
    }

    // Wymiar poziomy (X) - od punktu bazowego do punktu referencyjnego
    const deltaX = refPoint.x - basePoint.x;
    if (Math.abs(deltaX) > 0.1) {
        const hP1 = { x: basePoint.x, y: basePoint.y };
        const hP2 = { x: refPoint.x, y: basePoint.y };
        const hOffset = findOptimalOffset(hP1, hP2, existingDimensions, -40, -18);
        dims.push({
            id: generateId('dim-pos-x'),
            layerId: 'dimensions',
            p1: hP1,
            p2: hP2,
            offset: hOffset,
            text: deltaX.toFixed(1),
        });
    }

    // Wymiar pionowy (Y) - od punktu bazowego do punktu referencyjnego
    const deltaY = refPoint.y - basePoint.y;
    if (Math.abs(deltaY) > 0.1) {
        const vP1 = { x: basePoint.x, y: basePoint.y };
        const vP2 = { x: basePoint.x, y: refPoint.y };
        const vOffset = findOptimalOffset(vP1, vP2, [...existingDimensions, ...dims], -40, -18);
        dims.push({
            id: generateId('dim-pos-y'),
            layerId: 'dimensions',
            p1: vP1,
            p2: vP2,
            offset: vOffset,
            text: deltaY.toFixed(1),
        });
    }

    return dims;
};

// ============== GŁÓWNE FUNKCJE EKSPORTOWANE ==============

export const autoDimensionCircle = (
    circle: Circle,
    allShapes: Shape[],
    allDimensions: Dimension[]
): Dimension[] => {
    const newDimensions: Dimension[] = [];
    const currentDims = [...allDimensions];

    // Wymiar średnicy
    const diaDim = createCircleDiameterDimension(circle, currentDims);
    newDimensions.push(diaDim);
    currentDims.push(diaDim);

    // Sprawdź czy koło jest wewnątrz konturu
    const contour = findOuterContour(allShapes);
    if (contour && isShapeInsideContour(circle, contour)) {
        const contourBbox = getShapeBoundingBox(contour);
        const basePoint = { x: contourBbox.minX, y: contourBbox.minY };
        const posDims = createPositionalDimensions(circle, basePoint, currentDims);
        newDimensions.push(...posDims);
    }

    return newDimensions;
};

export const autoDimensionRectangle = (
    rect: Rectangle,
    allShapes: Shape[],
    allDimensions: Dimension[]
): Dimension[] => {
    const newDimensions: Dimension[] = [];
    const currentDims = [...allDimensions];

    // Wymiary prostokąta (szerokość, wysokość)
    const rectDims = createRectangleDimensions(rect, currentDims);
    newDimensions.push(...rectDims);
    currentDims.push(...rectDims);

    // Sprawdź czy prostokąt jest wewnątrz konturu (i nie jest sam konturem)
    const contour = findOuterContour(allShapes);
    if (contour && contour.id !== rect.id && isShapeInsideContour(rect, contour)) {
        const contourBbox = getShapeBoundingBox(contour);
        const basePoint = { x: contourBbox.minX, y: contourBbox.minY };
        const posDims = createPositionalDimensions(rect, basePoint, currentDims);
        newDimensions.push(...posDims);
    }

    return newDimensions;
};

export const autoDimensionAll = (
    drawingState: DrawingState,
    style: DimensionStyle = 'auto'
): Dimension[] => {
    const { shapes, dimensions } = drawingState;
    if (shapes.length === 0) return [];

    const newDimensions: Dimension[] = [];
    const currentDims = [...dimensions];

    // Znajdź kontur (największy prostokąt)
    const contour = findOuterContour(shapes);
    const contourBbox = contour ? getShapeBoundingBox(contour) : null;
    const basePoint = contourBbox 
        ? { x: contourBbox.minX, y: contourBbox.minY }
        : null;

    // Określ które kształty są wewnątrz konturu
    const innerShapes = contour 
        ? shapes.filter(s => isShapeInsideContour(s, contour))
        : [];

    const hasContourWithInnerShapes = contour && innerShapes.length > 0;

    // Określ czy dodawać wymiary pozycyjne
    const addPositionalDims = 
        style === 'full' || 
        (style === 'auto' && hasContourWithInnerShapes);

    // 1. Wymiary konturu (jeśli istnieje) - dedykowana funkcja, wymiary na zewnątrz
    if (contour && style !== 'shapes-only') {
        const contourDims = createContourDimensions(contour, currentDims);
        newDimensions.push(...contourDims);
        currentDims.push(...contourDims);
    }

    // 2. Wymiary poszczególnych kształtów (tylko wymiary samych kształtów, bez pozycyjnych)
    for (const shape of shapes) {
        // Pomiń kontur - już zwymiarowany
        if (contour && shape.id === contour.id) continue;

        if (shape.type === 'circle') {
            // Wymiar średnicy
            const diaDim = createCircleDiameterDimension(shape, currentDims);
            newDimensions.push(diaDim);
            currentDims.push(diaDim);
        } else if (shape.type === 'rectangle') {
            // Wymiary prostokąta
            const rectDims = createRectangleDimensions(shape, currentDims);
            newDimensions.push(...rectDims);
            currentDims.push(...rectDims);
        } else if (shape.type === 'line') {
            // Wymiar długości linii
            const length = Math.sqrt(
                Math.pow(shape.p2.x - shape.p1.x, 2) + 
                Math.pow(shape.p2.y - shape.p1.y, 2)
            );
            const offset = findOptimalOffset(shape.p1, shape.p2, currentDims, 20, 15);
            const lineDim: Dimension = {
                id: generateId('dim-line'),
                layerId: 'dimensions',
                p1: shape.p1,
                p2: shape.p2,
                offset,
                text: length.toFixed(1),
            };
            newDimensions.push(lineDim);
            currentDims.push(lineDim);
        }
    }

    // 3. Wymiary pozycyjne - wszystkie naraz, uporządkowane
    if (addPositionalDims && contour && contourBbox && basePoint && innerShapes.length > 0) {
        const posDims = createAllPositionalDimensions(innerShapes, basePoint, contourBbox, currentDims);
        newDimensions.push(...posDims);
    }

    return newDimensions;
};
