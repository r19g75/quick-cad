import { Circle, Shape, Dimension, Point, Rectangle, DrawingState, Line } from '../types';
import { getShapeBoundingBox } from './geometry';

// Styl wymiarowania
export type DimensionStyle = 'auto' | 'shapes-only' | 'full';

type BoundingBox = { minX: number; minY: number; maxX: number; maxY: number };

// ============== POMOCNICZE ==============

const TOLERANCE = 0.5; // Tolerancja dla porównywania punktów

const pointsEqual = (p1: Point, p2: Point): boolean => {
    return Math.abs(p1.x - p2.x) < TOLERANCE && Math.abs(p1.y - p2.y) < TOLERANCE;
};

// Sprawdza czy wymiar już istnieje (te same punkty końcowe)
const dimensionExists = (p1: Point, p2: Point, dimensions: Dimension[]): boolean => {
    for (const dim of dimensions) {
        // Sprawdź w obu kierunkach
        if ((pointsEqual(dim.p1, p1) && pointsEqual(dim.p2, p2)) ||
            (pointsEqual(dim.p1, p2) && pointsEqual(dim.p2, p1))) {
            return true;
        }
    }
    return false;
};

// Sprawdza czy wymiar o tej samej wartości istnieje na tej samej linii (poziomej lub pionowej)
const similarDimensionExists = (p1: Point, p2: Point, value: number, dimensions: Dimension[]): boolean => {
    const isHorizontal = Math.abs(p1.y - p2.y) < TOLERANCE;
    const isVertical = Math.abs(p1.x - p2.x) < TOLERANCE;
    
    for (const dim of dimensions) {
        const dimIsHorizontal = Math.abs(dim.p1.y - dim.p2.y) < TOLERANCE;
        const dimIsVertical = Math.abs(dim.p1.x - dim.p2.x) < TOLERANCE;
        
        // Oblicz wartość istniejącego wymiaru
        const dimValue = Math.sqrt(
            Math.pow(dim.p2.x - dim.p1.x, 2) + 
            Math.pow(dim.p2.y - dim.p1.y, 2)
        );
        
        // Ta sama wartość (z tolerancją)
        if (Math.abs(dimValue - value) > TOLERANCE) continue;
        
        // Ten sam typ linii i bliska pozycja
        if (isHorizontal && dimIsHorizontal) {
            // Sprawdź czy na podobnej wysokości
            if (Math.abs(p1.y - dim.p1.y) < 5) return true;
        }
        if (isVertical && dimIsVertical) {
            // Sprawdź czy na podobnej pozycji X
            if (Math.abs(p1.x - dim.p1.x) < 5) return true;
        }
    }
    return false;
};

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

// Bezpieczne dodawanie wymiaru (sprawdza duplikaty)
const addDimensionIfUnique = (
    dim: Dimension,
    newDimensions: Dimension[],
    allDimensions: Dimension[]
): boolean => {
    // Sprawdź czy już istnieje
    if (dimensionExists(dim.p1, dim.p2, allDimensions)) {
        return false;
    }
    if (dimensionExists(dim.p1, dim.p2, newDimensions)) {
        return false;
    }
    
    // Oblicz wartość wymiaru
    const value = Math.sqrt(
        Math.pow(dim.p2.x - dim.p1.x, 2) + 
        Math.pow(dim.p2.y - dim.p1.y, 2)
    );
    
    // Sprawdź czy podobny wymiar już istnieje
    if (similarDimensionExists(dim.p1, dim.p2, value, [...allDimensions, ...newDimensions])) {
        return false;
    }
    
    newDimensions.push(dim);
    return true;
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
    existingDimensions: Dimension[],
    newDimensions: Dimension[]
): Dimension[] => {
    const dims: Dimension[] = [];
    const bbox = getShapeBoundingBox(rect);
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;

    // Wymiar szerokości - NA DOLE konturu
    const widthP1 = { x: bbox.minX, y: bbox.minY };
    const widthP2 = { x: bbox.maxX, y: bbox.minY };
    
    const widthDim: Dimension = {
        id: generateId('dim-contour-w'),
        layerId: 'dimensions',
        p1: widthP1,
        p2: widthP2,
        offset: -45, // Na dole, poniżej ewentualnych wymiarów pozycyjnych
        text: width.toFixed(1),
    };
    
    if (!dimensionExists(widthP1, widthP2, existingDimensions) &&
        !dimensionExists(widthP1, widthP2, newDimensions)) {
        dims.push(widthDim);
    }

    // Wymiar wysokości - Z LEWEJ strony konturu
    const heightP1 = { x: bbox.minX, y: bbox.minY };
    const heightP2 = { x: bbox.minX, y: bbox.maxY };
    
    const heightDim: Dimension = {
        id: generateId('dim-contour-h'),
        layerId: 'dimensions',
        p1: heightP1,
        p2: heightP2,
        offset: -45, // Z lewej, poza ewentualnymi wymiarami pozycyjnymi
        text: height.toFixed(1),
    };
    
    if (!dimensionExists(heightP1, heightP2, existingDimensions) &&
        !dimensionExists(heightP1, heightP2, newDimensions)) {
        dims.push(heightDim);
    }

    return dims;
};

const createRectangleDimensions = (
    rect: Rectangle,
    contourBbox: BoundingBox | null,
    existingDimensions: Dimension[],
    newDimensions: Dimension[]
): Dimension[] => {
    const dims: Dimension[] = [];
    const bbox = getShapeBoundingBox(rect);
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;

    // Sprawdź czy wymiary nie pokrywają się z konturem
    if (contourBbox) {
        const contourWidth = contourBbox.maxX - contourBbox.minX;
        const contourHeight = contourBbox.maxY - contourBbox.minY;
        
        // Nie dodawaj wymiaru szerokości jeśli równa szerokości konturu
        if (Math.abs(width - contourWidth) < TOLERANCE) {
            // Pomiń wymiar szerokości
        } else {
            // Wymiar szerokości
            const widthP1 = { x: bbox.minX, y: bbox.minY };
            const widthP2 = { x: bbox.maxX, y: bbox.minY };
            
            if (!dimensionExists(widthP1, widthP2, existingDimensions) &&
                !dimensionExists(widthP1, widthP2, newDimensions) &&
                !similarDimensionExists(widthP1, widthP2, width, [...existingDimensions, ...newDimensions])) {
                const widthOffset = findOptimalOffset(widthP1, widthP2, [...existingDimensions, ...newDimensions], -25, -18);
                dims.push({
                    id: generateId('dim-w'),
                    layerId: 'dimensions',
                    p1: widthP1,
                    p2: widthP2,
                    offset: widthOffset,
                    text: width.toFixed(1),
                });
            }
        }
        
        // Nie dodawaj wymiaru wysokości jeśli równa wysokości konturu
        if (Math.abs(height - contourHeight) < TOLERANCE) {
            // Pomiń wymiar wysokości
        } else {
            // Wymiar wysokości
            const heightP1 = { x: bbox.minX, y: bbox.minY };
            const heightP2 = { x: bbox.minX, y: bbox.maxY };
            
            if (!dimensionExists(heightP1, heightP2, existingDimensions) &&
                !dimensionExists(heightP1, heightP2, newDimensions) &&
                !similarDimensionExists(heightP1, heightP2, height, [...existingDimensions, ...newDimensions, ...dims])) {
                const heightOffset = findOptimalOffset(heightP1, heightP2, [...existingDimensions, ...newDimensions, ...dims], -25, -18);
                dims.push({
                    id: generateId('dim-h'),
                    layerId: 'dimensions',
                    p1: heightP1,
                    p2: heightP2,
                    offset: heightOffset,
                    text: height.toFixed(1),
                });
            }
        }
    } else {
        // Brak konturu - dodaj oba wymiary
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
    }

    return dims;
};

// ============== WYMIARY POZYCYJNE ==============

// Zbiera wszystkie wymiary pozycyjne dla kształtów wewnątrz konturu
const createAllPositionalDimensions = (
    innerShapes: Shape[],
    basePoint: Point,
    contourBbox: BoundingBox,
    existingDimensions: Dimension[],
    newDimensions: Dimension[]
): Dimension[] => {
    const dims: Dimension[] = [];
    
    // Zbierz unikalne współrzędne X i Y
    const xCoords: Set<number> = new Set();
    const yCoords: Set<number> = new Set();
    
    for (const shape of innerShapes) {
        if (shape.type === 'circle') {
            xCoords.add(shape.center.x);
            yCoords.add(shape.center.y);
        } else {
            const bbox = getShapeBoundingBox(shape);
            xCoords.add(bbox.minX);
            xCoords.add(bbox.maxX);
            yCoords.add(bbox.minY);
            yCoords.add(bbox.maxY);
        }
    }
    
    // Filtruj współrzędne - usuń te które są na krawędzi konturu
    const filteredX = Array.from(xCoords).filter(x => 
        Math.abs(x - contourBbox.minX) > TOLERANCE && 
        Math.abs(x - contourBbox.maxX) > TOLERANCE
    ).sort((a, b) => a - b);
    
    const filteredY = Array.from(yCoords).filter(y => 
        Math.abs(y - contourBbox.minY) > TOLERANCE && 
        Math.abs(y - contourBbox.maxY) > TOLERANCE
    ).sort((a, b) => a - b);

    // Wymiary poziome (X) - na dole konturu
    const baseY = contourBbox.minY;
    let xDimLevel = 0;
    const X_DIM_START = -25;
    const X_DIM_INCREMENT = -20;

    for (const x of filteredX) {
        const deltaX = x - basePoint.x;
        if (Math.abs(deltaX) < TOLERANCE) continue;

        const p1 = { x: basePoint.x, y: baseY };
        const p2 = { x: x, y: baseY };
        
        // Sprawdź duplikaty
        if (dimensionExists(p1, p2, existingDimensions) ||
            dimensionExists(p1, p2, newDimensions) ||
            dimensionExists(p1, p2, dims)) {
            continue;
        }

        const offset = X_DIM_START + (xDimLevel * X_DIM_INCREMENT);
        dims.push({
            id: generateId('dim-pos-x'),
            layerId: 'dimensions',
            p1,
            p2,
            offset,
            text: Math.abs(deltaX).toFixed(1),
        });
        xDimLevel++;
    }

    // Wymiary pionowe (Y) - z lewej strony konturu
    const baseX = contourBbox.minX;
    let yDimLevel = 0;
    const Y_DIM_START = -25;
    const Y_DIM_INCREMENT = -20;

    for (const y of filteredY) {
        const deltaY = y - basePoint.y;
        if (Math.abs(deltaY) < TOLERANCE) continue;

        const p1 = { x: baseX, y: basePoint.y };
        const p2 = { x: baseX, y: y };
        
        // Sprawdź duplikaty
        if (dimensionExists(p1, p2, existingDimensions) ||
            dimensionExists(p1, p2, newDimensions) ||
            dimensionExists(p1, p2, dims)) {
            continue;
        }

        const offset = Y_DIM_START + (yDimLevel * Y_DIM_INCREMENT);
        dims.push({
            id: generateId('dim-pos-y'),
            layerId: 'dimensions',
            p1,
            p2,
            offset,
            text: Math.abs(deltaY).toFixed(1),
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
    if (Math.abs(deltaX) > TOLERANCE) {
        const hP1 = { x: basePoint.x, y: basePoint.y };
        const hP2 = { x: refPoint.x, y: basePoint.y };
        
        if (!dimensionExists(hP1, hP2, existingDimensions)) {
            const hOffset = findOptimalOffset(hP1, hP2, existingDimensions, -40, -18);
            dims.push({
                id: generateId('dim-pos-x'),
                layerId: 'dimensions',
                p1: hP1,
                p2: hP2,
                offset: hOffset,
                text: Math.abs(deltaX).toFixed(1),
            });
        }
    }

    // Wymiar pionowy (Y) - od punktu bazowego do punktu referencyjnego
    const deltaY = refPoint.y - basePoint.y;
    if (Math.abs(deltaY) > TOLERANCE) {
        const vP1 = { x: basePoint.x, y: basePoint.y };
        const vP2 = { x: basePoint.x, y: refPoint.y };
        
        if (!dimensionExists(vP1, vP2, existingDimensions) &&
            !dimensionExists(vP1, vP2, dims)) {
            const vOffset = findOptimalOffset(vP1, vP2, [...existingDimensions, ...dims], -40, -18);
            dims.push({
                id: generateId('dim-pos-y'),
                layerId: 'dimensions',
                p1: vP1,
                p2: vP2,
                offset: vOffset,
                text: Math.abs(deltaY).toFixed(1),
            });
        }
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
    if (!dimensionExists(diaDim.p1, diaDim.p2, currentDims)) {
        newDimensions.push(diaDim);
        currentDims.push(diaDim);
    }

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

    // Znajdź kontur
    const contour = findOuterContour(allShapes);
    const contourBbox = contour ? getShapeBoundingBox(contour) : null;

    // Wymiary prostokąta (szerokość, wysokość)
    const rectDims = createRectangleDimensions(rect, contourBbox, currentDims, newDimensions);
    newDimensions.push(...rectDims);
    currentDims.push(...rectDims);

    // Sprawdź czy prostokąt jest wewnątrz konturu (i nie jest sam konturem)
    if (contour && contour.id !== rect.id && isShapeInsideContour(rect, contour)) {
        const basePoint = { x: contourBbox!.minX, y: contourBbox!.minY };
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
        const contourDims = createContourDimensions(contour, currentDims, newDimensions);
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
            if (!dimensionExists(diaDim.p1, diaDim.p2, currentDims) &&
                !dimensionExists(diaDim.p1, diaDim.p2, newDimensions)) {
                newDimensions.push(diaDim);
                currentDims.push(diaDim);
            }
        } else if (shape.type === 'rectangle') {
            // Wymiary prostokąta - z uwzględnieniem konturu
            const rectDims = createRectangleDimensions(shape, contourBbox, currentDims, newDimensions);
            newDimensions.push(...rectDims);
            currentDims.push(...rectDims);
        } else if (shape.type === 'line') {
            // Wymiar długości linii
            const length = Math.sqrt(
                Math.pow(shape.p2.x - shape.p1.x, 2) + 
                Math.pow(shape.p2.y - shape.p1.y, 2)
            );
            
            if (!dimensionExists(shape.p1, shape.p2, currentDims) &&
                !dimensionExists(shape.p1, shape.p2, newDimensions)) {
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
    }

    // 3. Wymiary pozycyjne - wszystkie naraz, uporządkowane
    if (addPositionalDims && contour && contourBbox && basePoint && innerShapes.length > 0) {
        const posDims = createAllPositionalDimensions(innerShapes, basePoint, contourBbox, currentDims, newDimensions);
        newDimensions.push(...posDims);
    }

    return newDimensions;
};
