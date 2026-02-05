

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { produce } from 'immer';
import {
  Tool,
  Point,
  Shape,
  Layer,
  DrawingState,
  Dimension,
  TitleBlockData,
  Circle,
  Rectangle,
  SnapPoint,
} from './types';
import { INITIAL_LAYERS, LAYER_COLORS, SNAP_DISTANCE, GRID_SIZE } from './constants';
import {
  findSnapPoint,
  getDistance,
  pointToLineSegmentDistance,
} from './services/geometry';
import { exportToPdf, A4_WIDTH, A4_HEIGHT, MARGIN } from './services/exportPdf';
import { exportToDxf } from './services/exportDxf';
import { calculatePrintLayout } from './services/layout';
import { autoDimensionCircle, autoDimensionRectangle, autoDimensionAll, DimensionStyle } from './services/autoDimension';
import {
  SelectIcon,
  LineIcon,
  CircleIcon,
  RectangleIcon,
  DimensionIcon,
  SaveIcon,
  SaveAsIcon,
  LoadIcon,
  ZoomInIcon,
  ZoomOutIcon,
  UndoIcon,
  RedoIcon,
  TrashIcon,
  VisibleIcon,
  HiddenIcon,
  LockedIcon,
  UnlockedIcon,
  AutoDimensionIcon,
  AutoDimensionAllIcon,
  PrintPreviewIcon
} from './components/Icons';

const App: React.FC = () => {
  const [drawingState, setDrawingState] = useState<DrawingState>({
    shapes: [],
    dimensions: [],
    layers: INITIAL_LAYERS,
  });
  const [activeLayerId, setActiveLayerId] = useState<string>('contour');
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [tempShape, setTempShape] = useState<Shape | Dimension | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [history, setHistory] = useState<DrawingState[]>([drawingState]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [snapIndicator, setSnapIndicator] = useState<SnapPoint | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [dimensionStyle, setDimensionStyle] = useState<DimensionStyle>('auto');

  const [titleBlock, setTitleBlock] = useState<TitleBlockData>({
    detailName: 'Untitled Detail',
    material: 'S235JR',
    thickness: '5 mm',
    author: 'User',
    date: new Date().toLocaleDateString(),
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPanning = useRef(false);
  const startPanPoint = useRef({ x: 0, y: 0 });
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isDragging = useRef(false);
  const dragStartPoint = useRef<Point>({ x: 0, y: 0 });
  const initialDragState = useRef<DrawingState | null>(null);

  const supportsFileSystemAccess = useMemo(() => typeof window.showSaveFilePicker === 'function', []);

  useEffect(() => {
    let message = isPreviewMode ? `Print Preview Mode (A4 Landscape). Press Esc or click Preview button to exit.` : '';
    if (!isPreviewMode) {
        switch (activeTool) {
          case 'select':
            message = 'Click object to select. Use arrow keys to nudge selected dimension.';
            break;
          case 'line':
            message = drawingPoints.length === 0 ? 'Line: Click to set start point.' : 'Line: Click to set end point.';
            break;
          case 'circle':
            message = drawingPoints.length === 0 ? 'Circle: Click to set center point.' : 'Circle: Click to set radius.';
            break;
          case 'rectangle':
            message = drawingPoints.length === 0 ? 'Rectangle: Click to set first corner.' : 'Rectangle: Click to set opposite corner.';
            break;
          case 'dimension':
            if (drawingPoints.length === 0) {
              message = 'Dimension: Click first point.';
            } else if (drawingPoints.length === 1) {
              message = 'Dimension: Click second point.';
            } else {
              message = 'Dimension: Click to place dimension line.';
            }
            break;
          default:
            message = 'Ready';
        }
    }
    setStatusMessage(message);
  }, [activeTool, drawingPoints.length, isPreviewMode]);

  const updateStateAndHistory = (newState: DrawingState) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setDrawingState(newState);
  };
  
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setDrawingState(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setDrawingState(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const newState = produce(drawingState, draft => {
        draft.shapes = draft.shapes.filter(s => !selectedIds.has(s.id));
        draft.dimensions = draft.dimensions.filter(d => !selectedIds.has(d.id));
    });
    updateStateAndHistory(newState);
    setSelectedIds(new Set());
  }, [drawingState, selectedIds]);

  const handleUpdateElement = useCallback((id: string, updates: Partial<Shape | Dimension>) => {
      const newState = produce(drawingState, draft => {
          let item = draft.shapes.find(s => s.id === id) || draft.dimensions.find(d => d.id === id);
          if (item) {
              Object.assign(item, updates);
          }
      });
      updateStateAndHistory(newState);
  }, [drawingState]);

  const handleSaveAs = useCallback(async () => {
    if (supportsFileSystemAccess) {
      try {
          const handle = await window.showSaveFilePicker({
              suggestedName: `${titleBlock.detailName}.qcad`,
              types: [{
                  description: 'Quick CAD Files',
                  accept: { 'application/json': ['.qcad'] },
              }],
          });

          const newName = handle.name.replace('.qcad', '');
          const updatedTitleBlock = { ...titleBlock, detailName: newName };
          setTitleBlock(updatedTitleBlock);
          
          const dataToSave = { drawingState, titleBlock: updatedTitleBlock };
          
          const writable = await handle.createWritable();
          await writable.write(JSON.stringify(dataToSave, null, 2));
          await writable.close();

          fileHandleRef.current = handle;
          setStatusMessage(`File saved as: ${handle.name}`);
      } catch (err) {
          if ((err as DOMException).name !== 'AbortError') {
              console.error('Error saving file:', err);
              setStatusMessage('Error: Unable to save file.');
          }
      }
    } else {
      // Fallback for browsers that don't support the API
      const dataToSave = { drawingState, titleBlock };
      const dataStr = JSON.stringify(dataToSave, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${titleBlock.detailName}.qcad`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage('File saved.');
    }
  }, [supportsFileSystemAccess, titleBlock, drawingState]);
  
  const handleSave = useCallback(async () => {
    if (fileHandleRef.current) {
        try {
            const writable = await fileHandleRef.current.createWritable();
            const dataToSave = { drawingState, titleBlock };
            await writable.write(JSON.stringify(dataToSave, null, 2));
            await writable.close();
            setStatusMessage(`File saved: ${fileHandleRef.current.name}`);
            return;
        } catch (err) {
            console.error('Error saving file:', err);
            fileHandleRef.current = null;
        }
    }
    handleSaveAs();
  }, [handleSaveAs, drawingState, titleBlock]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawingPoints([]);
        setTempShape(null);
        setSelectedIds(new Set());
        setActiveTool('select');
        setIsPreviewMode(false);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Nudging dimensions with arrow keys
      if (selectedIds.size === 1 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const selectedId = selectedIds.values().next().value;
        const element = drawingState.dimensions.find(d => d.id === selectedId);
        
        if (element) {
            const nudgeAmount = e.shiftKey ? 5 : 1;
            const { p1, p2 } = element;
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const absAngle = Math.abs(angle);
            
            let newOffset = element.offset;

            // Horizontal-ish dimension
            if (absAngle < Math.PI / 4 || absAngle > (3 * Math.PI) / 4) {
                 if (e.key === 'ArrowUp') newOffset += nudgeAmount;
                 if (e.key === 'ArrowDown') newOffset -= nudgeAmount;
            } else { // Vertical-ish dimension
                 if (e.key === 'ArrowRight') newOffset += nudgeAmount;
                 if (e.key === 'ArrowLeft') newOffset -= nudgeAmount;
            }
            
            handleUpdateElement(element.id, { offset: newOffset });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, undo, redo, selectedIds, drawingState.dimensions, handleUpdateElement, handleSave]);


  const getCanvasCoords = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - view.x) / view.zoom;
    const y = (e.clientY - rect.top - view.y) / view.zoom;
    return { x, y };
  };
  
  const drawGrid = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) => {
    ctx.strokeStyle = '#4b5563'; // gray-600
    ctx.lineWidth = 0.5 / view.zoom;
    const scaledGridSize = GRID_SIZE * view.zoom;
  
    const startX = -view.x % scaledGridSize;
    const startY = -view.y % scaledGridSize;
  
    for (let x = startX; x < canvasWidth; x += scaledGridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }
    for (let y = startY; y < canvasHeight; y += scaledGridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }
  };

  const drawShape = (ctx: CanvasRenderingContext2D, shape: Shape, isSelected: boolean) => {
    const layer = drawingState.layers.find(l => l.id === shape.layerId);
    if (!layer || !layer.visible) return;

    ctx.strokeStyle = isSelected ? '#0ea5e9' : layer.color;
    ctx.lineWidth = (isSelected ? 2 : 1) / view.zoom;
    ctx.beginPath();

    switch (shape.type) {
      case 'line':
        ctx.moveTo(shape.p1.x, shape.p1.y);
        ctx.lineTo(shape.p2.x, shape.p2.y);
        break;
      case 'circle':
        ctx.arc(shape.center.x, shape.center.y, shape.radius, 0, 2 * Math.PI);
        break;
      case 'rectangle':
        ctx.rect(shape.p1.x, shape.p1.y, shape.p2.x - shape.p1.x, shape.p2.y - shape.p1.y);
        break;
    }
    ctx.stroke();
  };
  
  const drawDimension = (ctx: CanvasRenderingContext2D, dim: Dimension, isSelected: boolean) => {
      const layer = drawingState.layers.find(l => l.id === dim.layerId);
      if (!layer || !layer.visible) return;

      ctx.strokeStyle = isSelected ? '#0ea5e9' : layer.color;
      ctx.fillStyle = isSelected ? '#0ea5e9' : layer.color;
      ctx.lineWidth = 1 / view.zoom;
      ctx.font = `${12 / view.zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      
      const {p1, p2, offset} = dim;

      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const perpAngle = angle + Math.PI / 2;
      const dx = Math.cos(perpAngle) * offset;
      const dy = Math.sin(perpAngle) * offset;
      
      const dimP1 = {x: p1.x + dx, y: p1.y + dy};
      const dimP2 = {x: p2.x + dx, y: p2.y + dy};
      const midPoint = {x: (dimP1.x + dimP2.x)/2, y: (dimP1.y + dimP2.y)/2};

      const extLength = 15;
      
      // Extension lines
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p1.x + Math.cos(perpAngle)*(offset + extLength), p1.y + Math.sin(perpAngle)*(offset + extLength));
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x + Math.cos(perpAngle)*(offset + extLength), p2.y + Math.sin(perpAngle)*(offset + extLength));
      ctx.stroke();
      
      // Dimension line
      ctx.beginPath();
      ctx.moveTo(dimP1.x, dimP1.y);
      ctx.lineTo(dimP2.x, dimP2.y);
      ctx.stroke();
      
      const arrowSize = 8 / view.zoom;
      // Arrows
      drawArrow(ctx, dimP2, dimP1, arrowSize);
      drawArrow(ctx, dimP1, dimP2, arrowSize);

      // Text
      const text = `${dim.text || getDistance(p1, p2).toFixed(2)}`;
      ctx.save();
      ctx.translate(midPoint.x, midPoint.y);
      ctx.rotate(angle);
      if (angle > Math.PI/2 || angle < -Math.PI/2) {
          ctx.rotate(Math.PI);
      }
      ctx.fillText(text, 0, -5 / view.zoom);
      ctx.restore();
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, p1: Point, p2: Point, size: number) => {
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    ctx.save();
    ctx.beginPath();
    ctx.translate(p1.x, p1.y);
    ctx.rotate(angle);
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size / 3);
    ctx.lineTo(-size, size / 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (isPreviewMode) {
      const availableWidth = width - 2 * MARGIN;
      const availableHeight = height - 2 * MARGIN;
      const pageAspectRatio = A4_WIDTH / A4_HEIGHT;
      
      let paperWidth, paperHeight;
      if (availableWidth / availableHeight > pageAspectRatio) {
          paperHeight = availableHeight;
          paperWidth = paperHeight * pageAspectRatio;
      } else {
          paperWidth = availableWidth;
          paperHeight = paperWidth / pageAspectRatio;
      }

      const paperX = (width - paperWidth) / 2;
      const paperY = (height - paperHeight) / 2;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(paperX, paperY, paperWidth, paperHeight);
      ctx.strokeStyle = '#9ca3af';
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(paperX, paperY, paperWidth, paperHeight);
      ctx.setLineDash([]);
      
      const layout = calculatePrintLayout(drawingState, paperWidth, paperHeight, 10);
      
      ctx.save();
      ctx.translate(paperX, paperY);
      ctx.translate(layout.offsetX, layout.offsetY);
      ctx.scale(layout.finalScale, layout.finalScale);
      
      // Temporarily override view zoom for drawing functions
      const originalZoom = view.zoom;
      setView(v => ({...v, zoom: layout.finalScale}));

      drawingState.shapes.forEach(s => drawShape(ctx, s, false));
      drawingState.dimensions.forEach(d => drawDimension(ctx, d, false));
      
      setView(v => ({...v, zoom: originalZoom}));
      ctx.restore();

    } else {
      drawGrid(ctx, width, height);
      ctx.save();
      ctx.translate(view.x, view.y);
      ctx.scale(view.zoom, view.zoom);

      [...drawingState.shapes, ...(tempShape && 'type' in tempShape ? [tempShape] : [])].forEach(s => drawShape(ctx, s, selectedIds.has(s.id)));
      [...drawingState.dimensions, ...(tempShape && 'p1' in tempShape && 'p2' in tempShape && 'offset' in tempShape ? [tempShape] : [])].forEach(d => drawDimension(ctx, d, selectedIds.has(d.id)));

      ctx.restore();
    }
  }, [drawingState, view, tempShape, selectedIds, isPreviewMode]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPreviewMode) return;
    if (e.button === 1) { // Middle mouse button for panning
      isPanning.current = true;
      startPanPoint.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const currentPoint = getCanvasCoords(e);
    
    if (activeTool === 'select') {
      let minDistance = 10 / view.zoom;
      let foundId: string | null = null;
      
      const allItems = [...drawingState.shapes, ...drawingState.dimensions].reverse();

      for (const item of allItems) {
        let dist = Infinity;

        if ('type' in item) { // It's a Shape
            switch(item.type) {
                case 'line':
                    dist = pointToLineSegmentDistance(currentPoint, item.p1, item.p2);
                    break;
                case 'circle':
                    dist = Math.abs(getDistance(currentPoint, item.center) - item.radius);
                    break;
                case 'rectangle':
                    const { p1, p2 } = item;
                    const p3 = { x: p2.x, y: p1.y };
                    const p4 = { x: p1.x, y: p2.y };
                    dist = Math.min(
                        pointToLineSegmentDistance(currentPoint, p1, p3),
                        pointToLineSegmentDistance(currentPoint, p3, p2),
                        pointToLineSegmentDistance(currentPoint, p2, p4),
                        pointToLineSegmentDistance(currentPoint, p4, p1)
                    );
                    break;
            }
        } else if ('offset' in item) { // It's a Dimension
            const { p1, p2, offset } = item;
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const perpAngle = angle + Math.PI / 2;
            const dx = Math.cos(perpAngle) * offset;
            const dy = Math.sin(perpAngle) * offset;
            const dimP1 = { x: p1.x + dx, y: p1.y + dy };
            const dimP2 = { x: p2.x + dx, y: p2.y + dy };
            dist = pointToLineSegmentDistance(currentPoint, dimP1, dimP2);
        }

        if (dist < minDistance) {
          minDistance = dist;
          foundId = item.id;
        }
      }

      if (foundId) {
        setSelectedIds(new Set([foundId]));
        isDragging.current = true;
        dragStartPoint.current = currentPoint;
        initialDragState.current = drawingState;
      } else {
        setSelectedIds(new Set());
      }
      return;
    }
    
    const snapPoint = findSnapPoint(currentPoint, drawingState.shapes, SNAP_DISTANCE / view.zoom);
    const finalPoint = snapPoint?.point || currentPoint;
    
    const activeLayer = drawingState.layers.find(l => l.id === activeLayerId);
    if(activeLayer?.locked) return;
    
    const newPoints = [...drawingPoints, finalPoint];
    setDrawingPoints(newPoints);

    if (activeTool === 'line' && newPoints.length === 2) {
      const newShape: Shape = { id: Date.now().toString(), type: 'line', layerId: activeLayerId, p1: newPoints[0], p2: newPoints[1] };
      updateStateAndHistory(produce(drawingState, draft => { draft.shapes.push(newShape); }));
      setDrawingPoints([]);
      setTempShape(null);
    } else if (activeTool === 'circle' && newPoints.length === 2) {
      const radius = getDistance(newPoints[0], newPoints[1]);
      const newShape: Shape = { id: Date.now().toString(), type: 'circle', layerId: activeLayerId, center: newPoints[0], radius };
      updateStateAndHistory(produce(drawingState, draft => { draft.shapes.push(newShape); }));
      setDrawingPoints([]);
      setTempShape(null);
    } else if (activeTool === 'rectangle' && newPoints.length === 2) {
        const newShape: Shape = { id: Date.now().toString(), type: 'rectangle', layerId: activeLayerId, p1: newPoints[0], p2: newPoints[1] };
        updateStateAndHistory(produce(drawingState, draft => { draft.shapes.push(newShape); }));
        setDrawingPoints([]);
        setTempShape(null);
    } else if (activeTool === 'dimension' && newPoints.length === 2) {
        setDrawingPoints(newPoints); // Keep points for offset placement
    } else if (activeTool === 'dimension' && newPoints.length === 3) {
        const p1 = newPoints[0];
        const p2 = newPoints[1];
        const p3 = newPoints[2];
        const lineVec = {x: p2.x - p1.x, y: p2.y - p1.y};
        const pointVec = {x: p3.x - p1.x, y: p3.y - p1.y};
        const offset = (pointVec.x * lineVec.y - pointVec.y * lineVec.x) / getDistance(p1,p2);

        const newDim: Dimension = { id: Date.now().toString(), layerId: 'dimensions', p1, p2, offset };
        updateStateAndHistory(produce(drawingState, draft => { draft.dimensions.push(newDim); }));
        setDrawingPoints([]);
        setTempShape(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPreviewMode) return;
    if (isPanning.current) {
      setView(prev => ({
        ...prev,
        x: prev.x + e.clientX - startPanPoint.current.x,
        y: prev.y + e.clientY - startPanPoint.current.y,
      }));
      startPanPoint.current = { x: e.clientX, y: e.clientY };
      return;
    }
    
    const currentPoint = getCanvasCoords(e);
    
    if (isDragging.current && selectedIds.size > 0 && initialDragState.current) {
        const dx = currentPoint.x - dragStartPoint.current.x;
        const dy = currentPoint.y - dragStartPoint.current.y;
        const selectedId = selectedIds.values().next().value;
        
        const nextState = produce(initialDragState.current, draft => {
            let item = draft.shapes.find(s => s.id === selectedId) || draft.dimensions.find(d => d.id === selectedId);
            if(item) {
                if ('p1' in item) { item.p1.x += dx; item.p1.y += dy; }
                if ('p2' in item) { item.p2.x += dx; item.p2.y += dy; }
                if ('center' in item) { item.center.x += dx; item.center.y += dy; }
            }
        });
        setDrawingState(nextState);
        return;
    }
    
    const snapPoint = findSnapPoint(currentPoint, drawingState.shapes, SNAP_DISTANCE / view.zoom);
    setSnapIndicator(activeTool !== 'select' ? snapPoint : null);
    const finalPoint = snapPoint?.point || currentPoint;

    if (drawingPoints.length > 0) {
      const p1 = drawingPoints[0];
      if (activeTool === 'line') {
        setTempShape({ id: 'temp', type: 'line', layerId: activeLayerId, p1, p2: finalPoint });
      } else if (activeTool === 'circle') {
        setTempShape({ id: 'temp', type: 'circle', layerId: activeLayerId, center: p1, radius: getDistance(p1, finalPoint) });
      } else if (activeTool === 'rectangle') {
        setTempShape({ id: 'temp', type: 'rectangle', layerId: activeLayerId, p1, p2: finalPoint });
      } else if (activeTool === 'dimension' && drawingPoints.length === 2) {
        const p1_dim = drawingPoints[0];
        const p2_dim = drawingPoints[1];
        const lineVec = {x: p2_dim.x - p1_dim.x, y: p2_dim.y - p1_dim.y};
        const pointVec = {x: finalPoint.x - p1_dim.x, y: finalPoint.y - p1_dim.y};
        const offset = (pointVec.x * lineVec.y - pointVec.y * lineVec.x) / getDistance(p1_dim, p2_dim);
        setTempShape({ id: 'temp', layerId: 'dimensions', p1: p1_dim, p2: p2_dim, offset });
      }
    } else {
        setTempShape(null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPreviewMode) return;
    if (e.button === 1) isPanning.current = false;
    if (isDragging.current) {
        isDragging.current = false;
        initialDragState.current = null;
        updateStateAndHistory(drawingState);
    }
  };
  
  const handleWheel = (e: React.WheelEvent) => {
    if (isPreviewMode) return;
    const scaleFactor = 1.1;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newZoom = e.deltaY < 0 ? view.zoom * scaleFactor : view.zoom / scaleFactor;
    const zoomRatio = newZoom / view.zoom;

    setView({
      zoom: newZoom,
      x: mouseX - (mouseX - view.x) * zoomRatio,
      y: mouseY - (mouseY - view.y) * zoomRatio,
    });
  };

  const zoomInOut = (factor: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    const centerX = width / 2;
    const centerY = height / 2;

    const newZoom = view.zoom * factor;
    const zoomRatio = newZoom / view.zoom;
    
    setView({
        zoom: newZoom,
        x: centerX - (centerX - view.x) * zoomRatio,
        y: centerY - (centerY - view.y) * zoomRatio,
    });
  };

  const toggleLayerVisibility = (layerId: string) => {
      setDrawingState(produce(drawingState, draft => {
          const layer = draft.layers.find(l => l.id === layerId);
          if (layer) layer.visible = !layer.visible;
      }));
  };

  const toggleLayerLock = (layerId: string) => {
      setDrawingState(produce(drawingState, draft => {
          const layer = draft.layers.find(l => l.id === layerId);
          if (layer) layer.locked = !layer.locked;
      }));
  };

  const handleAutoDimension = (elementId: string) => {
    const element = drawingState.shapes.find(s => s.id === elementId);
    if (!element) return;

    let newDimensions: Dimension[] = [];
    if (element.type === 'circle') {
        newDimensions = autoDimensionCircle(
            element as Circle,
            drawingState.shapes,
            drawingState.dimensions
        );
    } else if (element.type === 'rectangle') {
        newDimensions = autoDimensionRectangle(
            element as Rectangle,
            drawingState.shapes,
            drawingState.dimensions
        );
    }

    if (newDimensions.length > 0) {
        const newState = produce(drawingState, draft => {
            draft.dimensions.push(...newDimensions);
        });
        updateStateAndHistory(newState);
    }
  };
  
  const handleAutoDimensionAll = () => {
      const newDimensions = autoDimensionAll(drawingState, dimensionStyle);
      if(newDimensions.length > 0) {
          const newState = produce(drawingState, draft => {
            draft.dimensions.push(...newDimensions);
          });
          updateStateAndHistory(newState);
          setStatusMessage(`Added ${newDimensions.length} dimensions.`);
      } else {
          setStatusMessage('No new dimensions to add.');
      }
  };

  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  
  const handleLoadClick = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
            types: [{
                description: 'Quick CAD Files',
                accept: { 'application/json': ['.qcad'] },
            }],
        });
        const file = await handle.getFile();
        const content = await file.text();
        const loadedData = JSON.parse(content);

        if (loadedData.drawingState && loadedData.drawingState.shapes && loadedData.drawingState.layers) {
            setDrawingState(loadedData.drawingState);
            setHistory([loadedData.drawingState]);
            setHistoryIndex(0);
            if (loadedData.titleBlock) {
                setTitleBlock(loadedData.titleBlock);
            }
            setSelectedIds(new Set());
            setDrawingPoints([]);
            setTempShape(null);
            fileHandleRef.current = handle;
            setStatusMessage(`Loaded file: ${file.name}`);
        } else {
            throw new Error("Invalid file format");
        }
    } catch (err) {
        if ((err as DOMException).name !== 'AbortError') {
            console.error('Error opening file:', err);
            setStatusMessage('Error: Could not load file.');
        }
    }
    } else {
      // Fallback for browsers that don't support the API
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result;
            if (typeof text !== 'string') throw new Error("File is not text");
            const loadedData = JSON.parse(text);

            if (loadedData.drawingState && loadedData.drawingState.shapes && loadedData.drawingState.layers) {
                const loadedDrawingState = loadedData.drawingState;
                setDrawingState(loadedDrawingState);
                setHistory([loadedDrawingState]);
                setHistoryIndex(0);
                if (loadedData.titleBlock) {
                    setTitleBlock(loadedData.titleBlock);
                }
                setSelectedIds(new Set());
                setDrawingPoints([]);
                setTempShape(null);
                fileHandleRef.current = null; // Can't get a handle in fallback mode
                setStatusMessage(`Loaded file: ${file.name}`);
            } else {
                throw new Error("Invalid file format");
            }
        } catch (error) {
            console.error("Failed to load or parse file:", error);
            setStatusMessage("Error: Could not load file. Invalid format.");
        }
    };
    reader.onerror = () => {
        setStatusMessage("Error reading file.");
    };
    reader.readAsText(file);
    if (event.target) {
        event.target.value = '';
    }
  };

  const ToolButton: React.FC<{ tool: Tool, label: string, children: React.ReactNode }> = ({ tool, label, children }) => (
    <button
      onClick={() => setActiveTool(tool)}
      className={`p-2 rounded-md ${activeTool === tool ? 'bg-sky-600' : 'bg-gray-700 hover:bg-gray-600'} transition-colors`}
      title={label}
    >
      {children}
    </button>
  );

  return (
    <div className="flex h-screen w-screen bg-gray-800 text-gray-100 font-sans">
      {/* Left Toolbar */}
      <aside className="w-16 bg-gray-900 p-2 flex flex-col items-center space-y-4">
        <h1 className="text-sky-400 font-bold text-lg">QC</h1>
        <div className="flex flex-col space-y-2">
            <ToolButton tool="select" label="Select"><SelectIcon /></ToolButton>
            <ToolButton tool="line" label="Line"><LineIcon /></ToolButton>
            <ToolButton tool="circle" label="Circle"><CircleIcon /></ToolButton>
            <ToolButton tool="rectangle" label="Rectangle"><RectangleIcon /></ToolButton>
            <ToolButton tool="dimension" label="Dimension"><DimensionIcon /></ToolButton>
        </div>
        <div className="flex-grow"></div>
        <div className="flex flex-col space-y-2">
          <button onClick={undo} title="Undo (Ctrl+Z)" className="p-2 rounded-md bg-gray-700 hover:bg-gray-600"><UndoIcon /></button>
          <button onClick={redo} title="Redo (Ctrl+Y)" className="p-2 rounded-md bg-gray-700 hover:bg-gray-600"><RedoIcon /></button>
          <button onClick={deleteSelected} title="Delete" className="p-2 rounded-md bg-gray-700 hover:bg-gray-600"><TrashIcon /></button>
        </div>
        <div className="flex-grow"></div>
        <div className="flex flex-col space-y-2">
            <button onClick={() => zoomInOut(1.2)} title="Zoom In" className="p-2 rounded-md bg-gray-700 hover:bg-gray-600"><ZoomInIcon /></button>
            <button onClick={() => zoomInOut(1 / 1.2)} title="Zoom Out" className="p-2 rounded-md bg-gray-700 hover:bg-gray-600"><ZoomOutIcon /></button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-10 bg-gray-700 flex items-center px-4 justify-between">
            <div className="text-sm">Quick-CAD 2D</div>
            <div className="flex items-center space-x-2">
              <button onClick={handleSave} className="px-3 py-1 bg-sky-600 hover:bg-sky-700 rounded-md text-sm font-semibold flex items-center space-x-1" title={supportsFileSystemAccess ? 'Save (Ctrl+S)' : 'Save a Copy (Ctrl+S)'}>
                <SaveIcon />
                <span>Save</span>
              </button>
              <button onClick={handleSaveAs} className="px-3 py-1 bg-sky-600 hover:bg-sky-700 rounded-md text-sm font-semibold flex items-center space-x-1" title="Save As...">
                <SaveAsIcon />
                <span>Save As</span>
              </button>
              <button onClick={handleLoadClick} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded-md text-sm font-semibold flex items-center space-x-1">
                <LoadIcon />
                <span>Load</span>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".qcad,application/json" style={{ display: 'none' }} />
              <div className="flex items-center space-x-1">
                <select 
                  value={dimensionStyle} 
                  onChange={(e) => setDimensionStyle(e.target.value as DimensionStyle)}
                  className="px-2 py-1 bg-gray-700 text-sm rounded-l-md border-r border-gray-600 focus:outline-none"
                  title="Dimension style"
                >
                  <option value="auto">Auto</option>
                  <option value="shapes-only">Shapes Only</option>
                  <option value="full">Full</option>
                </select>
                <button onClick={handleAutoDimensionAll} className="px-3 py-1 bg-teal-600 hover:bg-teal-700 rounded-r-md text-sm font-semibold flex items-center space-x-1" title="Automatically dimension all features">
                  <AutoDimensionAllIcon />
                  <span>Dimension</span>
                </button>
              </div>
              <button
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className={`px-3 py-1 rounded-md text-sm font-semibold flex items-center space-x-1 ${isPreviewMode ? 'bg-indigo-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                title="Toggle Print Preview"
              >
                <PrintPreviewIcon />
                <span>Preview</span>
              </button>
              <button onClick={() => setIsExportPanelOpen(true)} className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded-md text-sm font-semibold">
                Export
              </button>
            </div>
        </header>

        {/* Canvas Area */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            className={`w-full h-full bg-gray-800 ${isDragging.current ? 'cursor-move' : activeTool !== 'select' ? 'cursor-default' : 'cursor-crosshair'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={(e) => { 
                isPanning.current = false; 
                if (isDragging.current) { handleMouseUp(e); }
                setTempShape(null);
                setSnapIndicator(null);
            }}
            onWheel={handleWheel}
          />
          {snapIndicator && !isPreviewMode && (
            <div
                className="snap-indicator"
                style={{
                    left: `${snapIndicator.point.x * view.zoom + view.x}px`,
                    top: `${snapIndicator.point.y * view.zoom + view.y}px`,
                }}
            />
          )}
        </div>
        
        {/* Status Bar */}
        <footer className="h-8 bg-gray-900 flex items-center px-4 border-t border-gray-700">
            <p className="text-sm text-gray-300">{statusMessage}</p>
        </footer>
      </main>

      {/* Right Panels */}
      <aside className="w-64 bg-gray-900 p-4 flex flex-col space-y-6">
        {/* Properties Panel */}
        <PropertiesPanel
          selectedIds={selectedIds}
          drawingState={drawingState}
          onUpdate={handleUpdateElement}
          onAutoDimension={handleAutoDimension}
        />
        {/* Layers Panel */}
        <div>
            <h2 className="text-lg font-semibold mb-3 border-b border-gray-700 pb-2">Layers</h2>
            <div className="space-y-2">
              {drawingState.layers.map(layer => (
                <div key={layer.id} className={`p-2 rounded-md flex items-center justify-between transition-colors ${activeLayerId === layer.id ? 'bg-sky-800' : 'bg-gray-800'}`}>
                  <button onClick={() => setActiveLayerId(layer.id)} className="flex items-center space-x-2 flex-grow text-left disabled:opacity-50" disabled={layer.locked}>
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: layer.color }}></div>
                    <span className="text-sm">{layer.name}</span>
                  </button>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => toggleLayerLock(layer.id)} title={layer.locked ? 'Unlock' : 'Lock'}>
                      {layer.locked ? <LockedIcon /> : <UnlockedIcon />}
                    </button>
                    <button onClick={() => toggleLayerVisibility(layer.id)} title={layer.visible ? 'Hide' : 'Show'}>
                      {layer.visible ? <VisibleIcon /> : <HiddenIcon />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
        </div>
      </aside>
      
      {isExportPanelOpen && <ExportPanel drawingState={drawingState} onClose={() => setIsExportPanelOpen(false)} titleBlock={titleBlock} onTitleBlockChange={setTitleBlock} />}
    </div>
  );
};

interface PropertiesPanelProps {
  selectedIds: Set<string>;
  drawingState: DrawingState;
  onUpdate: (id: string, updates: Partial<Shape | Dimension>) => void;
  onAutoDimension: (id: string) => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedIds, drawingState, onUpdate, onAutoDimension }) => {
  if (selectedIds.size !== 1) {
    return (
        <div>
            <h2 className="text-lg font-semibold mb-3 border-b border-gray-700 pb-2">Properties</h2>
            <p className="text-xs text-gray-400">
              Select a single element to see its properties.
              <br/>
              Click and drag an element on the canvas to move it.
            </p>
        </div>
    );
  }
  const selectedId = selectedIds.values().next().value;
  const element = [...drawingState.shapes, ...drawingState.dimensions].find(e => e.id === selectedId);

  if (!element) return null;
  
  const handlePointChange = (pointName: 'p1' | 'p2' | 'center', coord: 'x' | 'y', value: number) => {
    if (!isNaN(value)) {
      const originalPoint = (element as any)[pointName];
      onUpdate(element.id, { [pointName]: { ...originalPoint, [coord]: value } });
    }
  };

  const handleValueChange = (propName: 'radius' | 'text' | 'offset', value: string | number) => {
    onUpdate(element.id, { [propName]: value });
  };
  
  const handleRectangleDimensionChange = (dimension: 'width' | 'height', value: number) => {
      if ('type' in element && element.type === 'rectangle' && !isNaN(value) && value >= 0) {
          const { p1, p2 } = element;
          const newP2 = {
              x: dimension === 'width' ? p1.x + value : p2.x,
              y: dimension === 'height' ? p1.y + value : p2.y
          };
          onUpdate(element.id, { p2: newP2 });
      }
  };

  const renderPointInputs = (name: string, pointKey: 'p1' | 'p2' | 'center', point: Point) => (
    <>
      <div className="font-semibold text-xs text-gray-400 mt-2">{name}</div>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput label="X" value={point.x} onChange={val => handlePointChange(pointKey, 'x', val)} />
        <NumberInput label="Y" value={point.y} onChange={val => handlePointChange(pointKey, 'y', val)} />
      </div>
    </>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-3 border-b border-gray-700 pb-2">
        <h2 className="text-lg font-semibold">Properties</h2>
        {'type' in element && (element.type === 'circle' || element.type === 'rectangle') && (
            <button onClick={() => onAutoDimension(element.id)} title="Auto Dimension" className="p-1 rounded-md bg-sky-700 hover:bg-sky-600">
                <AutoDimensionIcon />
            </button>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-300 capitalize">{'type' in element ? element.type : 'Dimension'}</p>
        {'type' in element && element.type === 'line' && (
            <>
                {renderPointInputs('Start Point', 'p1', element.p1)}
                {renderPointInputs('End Point', 'p2', element.p2)}
            </>
        )}
        {'type' in element && element.type === 'rectangle' && (
            <>
                {renderPointInputs('Origin Corner (X0, Y0)', 'p1', element.p1)}
                <div className="font-semibold text-xs text-gray-400 mt-2">Size (mm)</div>
                <div className="grid grid-cols-2 gap-2">
                    <NumberInput
                        label="Width"
                        value={Math.abs(element.p2.x - element.p1.x)}
                        onChange={val => handleRectangleDimensionChange('width', val)}
                    />
                    <NumberInput
                        label="Height"
                        value={Math.abs(element.p2.y - element.p1.y)}
                        onChange={val => handleRectangleDimensionChange('height', val)}
                    />
                </div>
            </>
        )}
        {'type' in element && element.type === 'circle' && (
            <>
                {renderPointInputs('Center', 'center', element.center)}
                <div className="font-semibold text-xs text-gray-400 mt-2">Radius</div>
                <NumberInput label="R" value={element.radius} onChange={val => handleValueChange('radius', val)} />
            </>
        )}
        {'offset' in element && (
            <>
                <div className="font-semibold text-xs text-gray-400 mt-2">Dimension Text</div>
                 <input
                    type="text"
                    defaultValue={element.text || ''}
                    placeholder={getDistance(element.p1, element.p2).toFixed(2)}
                    onBlur={(e) => handleValueChange('text', e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="w-full bg-gray-700 p-1.5 text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                 <div className="font-semibold text-xs text-gray-400 mt-2">Offset</div>
                <NumberInput label="Offset" value={element.offset} onChange={val => handleValueChange('offset', val)} />
            </>
        )}
      </div>
    </div>
  );
};

const NumberInput: React.FC<{label: string, value: number, onChange: (val: number) => void}> = ({label, value, onChange}) => {
    // FIX: Removed redundant `String()` wrapper. `value.toFixed(2)` already returns a string.
    const [localValue, setLocalValue] = useState(value.toFixed(2));

    useEffect(() => {
        if (parseFloat(localValue) !== value) {
            // FIX: Removed redundant `String()` wrapper. `value.toFixed(2)` already returns a string.
            setLocalValue(value.toFixed(2));
        }
    }, [value]);

    const commitChange = () => {
        const numericValue = parseFloat(localValue);
        if (!isNaN(numericValue) && numericValue !== value) {
            onChange(numericValue);
        } else {
            // FIX: Removed redundant `String()` wrapper. `value.toFixed(2)` already returns a string.
            setLocalValue(value.toFixed(2));
        }
    };
    
    return (
        <div>
            <label className="text-xs text-gray-400">{label}</label>
            <input 
                type="number"
                step="0.1"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={commitChange}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="w-full bg-gray-700 p-1.5 text-sm rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
        </div>
    );
};

interface ExportPanelProps {
  drawingState: DrawingState;
  onClose: () => void;
  titleBlock: TitleBlockData;
  onTitleBlockChange: React.Dispatch<React.SetStateAction<TitleBlockData>>;
}

const ExportPanel: React.FC<ExportPanelProps> = ({ drawingState, onClose, titleBlock, onTitleBlockChange }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onTitleBlockChange(prev => ({ ...prev, [name]: value }));
  };

  const handleExportPdf = () => {
    exportToPdf(drawingState, titleBlock, 'A4', 1);
  };
  
  const handleExportDxf = () => {
    exportToDxf(drawingState, titleBlock);
  };
  
  return (
    <div className="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md text-gray-100">
        <h2 className="text-2xl font-bold mb-6">Export Drawing</h2>
        
        <div className="space-y-4 mb-6">
          <input type="text" name="detailName" value={titleBlock.detailName} onChange={handleInputChange} placeholder="Detail Name" className="w-full bg-gray-700 p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500"/>
          <input type="text" name="material" value={titleBlock.material} onChange={handleInputChange} placeholder="Material" className="w-full bg-gray-700 p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500"/>
          <input type="text" name="thickness" value={titleBlock.thickness} onChange={handleInputChange} placeholder="Thickness" className="w-full bg-gray-700 p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500"/>
          <input type="text" name="author" value={titleBlock.author} onChange={handleInputChange} placeholder="Author" className="w-full bg-gray-700 p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500"/>
        </div>

        <div className="flex justify-end space-x-4">
          <button onClick={handleExportPdf} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-semibold">Export PDF</button>
          <button onClick={handleExportDxf} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md font-semibold">Export DXF</button>
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md font-semibold">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default App;
