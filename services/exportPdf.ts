
import { jsPDF } from 'jspdf';
import { DrawingState, TitleBlockData, Shape, Dimension, Point, Annotation, TextAnnotation, LeaderAnnotation } from '../types';
import { getDistance } from './geometry';
import { calculatePrintLayout } from './layout';

// A4 dimensions in mm
export const A4_WIDTH = 297;
export const A4_HEIGHT = 210;
export const MARGIN = 10;

// Helper to draw arrows for dimensions
const drawPdfArrow = (doc: jsPDF, p1: Point, p2: Point, size: number) => {
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const x1 = p1.x;
    const y1 = p1.y;

    // A more robust arrow drawing using a filled path
    const arrowAngle = Math.PI / 8;
    const x2 = p1.x - size * Math.cos(angle - arrowAngle);
    const y2 = p1.y - size * Math.sin(angle - arrowAngle);
    const x3 = p1.x - size * Math.cos(angle + arrowAngle);
    const y3 = p1.y - size * Math.sin(angle + arrowAngle);

    doc.path([
        {op: 'm', c: [x1, y1]},
        {op: 'l', c: [x2, y2]},
        {op: 'l', c: [x3, y3]},
        {op: 'h'}, // close path
    ]).fill();
};


export const exportToPdf = (
  drawingState: DrawingState,
  titleBlockData: TitleBlockData,
  pageSize: 'A4' | 'A3',
  scale: number // Note: this scale parameter is currently unused, auto-scaling is performed.
) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: pageSize.toLowerCase(),
  });

  const pageWidth = pageSize === 'A4' ? A4_WIDTH : 420;
  const pageHeight = pageSize === 'A4' ? A4_HEIGHT : 297;
  const availableWidth = pageWidth - 2 * MARGIN;
  const availableHeight = pageHeight - MARGIN - 25; // Leave space for title block

  const { finalScale, offsetX, offsetY } = calculatePrintLayout(
      drawingState,
      availableWidth,
      availableHeight,
      MARGIN
  );

  const transform = (p: Point) => ({
      x: p.x * finalScale + offsetX,
      y: p.y * finalScale + offsetY
  });

  // --- Draw Frame and Title Block ---
  doc.setDrawColor('#000000');
  doc.setLineWidth(0.5);
  doc.rect(MARGIN, MARGIN, pageWidth - 2 * MARGIN, pageHeight - 2 * MARGIN);
  
  const titleBlockY = pageHeight - MARGIN;
  const titleBlockX = pageWidth - MARGIN;
  doc.rect(titleBlockX - 80, titleBlockY - 20, 80, 20);
  doc.setFontSize(8);
  doc.setTextColor('#000000');
  doc.text(`Detail: ${titleBlockData.detailName}`, titleBlockX - 78, titleBlockY - 16);
  doc.text(`Material: ${titleBlockData.material}`, titleBlockX - 78, titleBlockY - 12);
  doc.text(`Thickness: ${titleBlockData.thickness}`, titleBlockX - 78, titleBlockY - 8);
  doc.text(`Author: ${titleBlockData.author}`, titleBlockX - 40, titleBlockY - 16);
  doc.text(`Date: ${titleBlockData.date}`, titleBlockX - 40, titleBlockY - 12);
  doc.text(`Scale: 1:${(1/finalScale).toFixed(2)}`, titleBlockX - 40, titleBlockY - 8);

  // --- Draw Shapes ---
  drawingState.shapes.forEach(shape => {
    const layer = drawingState.layers.find(l => l.id === shape.layerId);
    if (!layer || !layer.visible) return;

    const drawColor = layer.color === '#ffffff' ? '#000000' : layer.color;
    doc.setDrawColor(drawColor);
    doc.setLineWidth(layer.id === 'contour' ? 0.3 : 0.1);

    if (shape.type === 'line') {
      const {p1, p2} = shape;
      const tP1 = transform(p1);
      const tP2 = transform(p2);
      doc.line(tP1.x, tP1.y, tP2.x, tP2.y);
    } else if (shape.type === 'circle') {
      const {center, radius} = shape;
      const tCenter = transform(center);
      doc.circle(tCenter.x, tCenter.y, radius * finalScale);
    } else if (shape.type === 'rectangle') {
        const {p1, p2} = shape;
        const tP1 = transform(p1);
        doc.rect(tP1.x, tP1.y, (p2.x - p1.x) * finalScale, (p2.y - p1.y) * finalScale);
    }
  });
  
  // --- Draw Dimensions ---
  const dimLayer = drawingState.layers.find(l => l.id === 'dimensions');
  if (dimLayer && dimLayer.visible) {
    const dimColor = dimLayer.color === '#ffffff' ? '#000000' : dimLayer.color;
    doc.setDrawColor(dimColor);
    doc.setTextColor(dimColor);
    doc.setLineWidth(0.1);
    doc.setFontSize(8);

    drawingState.dimensions.forEach(dim => {
      const { p1, p2, offset, text } = dim;
      
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const perpAngle = angle + Math.PI / 2;
      const dx = Math.cos(perpAngle) * offset;
      const dy = Math.sin(perpAngle) * offset;
      
      const dimP1 = { x: p1.x + dx, y: p1.y + dy };
      const dimP2 = { x: p2.x + dx, y: p2.y + dy };
      
      const extLength = 3; // Extension line overshoot in mm

      const extP1Start = {x: p1.x, y: p1.y};
      const extP2Start = {x: p2.x, y: p2.y};
      
      const extP1GapEnd = {x: p1.x + Math.cos(perpAngle) * (offset - extLength), y: p1.y + Math.sin(perpAngle) * (offset - extLength)};
      const extP2GapEnd = {x: p2.x + Math.cos(perpAngle) * (offset - extLength), y: p2.y + Math.sin(perpAngle) * (offset - extLength)};


      // Transform all points to page coordinates
      const tDimP1 = transform(dimP1);
      const tDimP2 = transform(dimP2);
      const tExtP1Start = transform(extP1Start);
      const tExtP1End = transform(extP1GapEnd);
      const tExtP2Start = transform(extP2Start);
      const tExtP2End = transform(extP2GapEnd);
      
      // Draw dimension line
      doc.line(tDimP1.x, tDimP1.y, tDimP2.x, tDimP2.y);
      
      // Draw extension lines
      doc.line(tExtP1Start.x, tExtP1Start.y, tExtP1End.x, tExtP1End.y);
      doc.line(tExtP2Start.x, tExtP2Start.y, tExtP2End.x, tExtP2End.y);

      // Draw arrows
      const arrowSize = 2; // in mm
      doc.setFillColor(dimColor);
      drawPdfArrow(doc, tDimP1, tDimP2, arrowSize);
      drawPdfArrow(doc, tDimP2, tDimP1, arrowSize);

      // Draw Text
      const dimText = text || getDistance(p1, p2).toFixed(2);
      const midPoint = {x: (dimP1.x + dimP2.x)/2, y: (dimP1.y + dimP2.y)/2};
      const tMid = transform(midPoint);
      
      let textAngle = angle * (180 / Math.PI);
      if (textAngle > 90) textAngle -= 180;
      if (textAngle < -90) textAngle += 180;
      
      doc.text(dimText, tMid.x, tMid.y - 1, { align: 'center', angle: textAngle });
    });
  }

  // --- Draw Annotations ---
  const annotLayer = drawingState.layers.find(l => l.id === 'annotations');
  if (annotLayer && annotLayer.visible && drawingState.annotations) {
    const annotColor = annotLayer.color === '#ffffff' ? '#000000' : annotLayer.color;
    
    drawingState.annotations.forEach(annotation => {
      if (annotation.type === 'text') {
        const textAnnot = annotation as TextAnnotation;
        const tPos = transform(textAnnot.position);
        const fontSize = (textAnnot.fontSize || 12) * finalScale;
        doc.setFontSize(Math.max(6, Math.min(fontSize, 14))); // Clamp font size
        doc.setTextColor(textAnnot.color || annotColor);
        doc.text(textAnnot.text, tPos.x, tPos.y);
      } else if (annotation.type === 'leader') {
        const leader = annotation as LeaderAnnotation;
        const tArrow = transform(leader.arrowPoint);
        const tElbow = transform(leader.elbowPoint);
        const tText = transform(leader.textPoint);
        
        doc.setDrawColor(annotColor);
        doc.setLineWidth(0.15);
        
        // Draw lines
        doc.line(tArrow.x, tArrow.y, tElbow.x, tElbow.y);
        doc.line(tElbow.x, tElbow.y, tText.x, tText.y);
        
        // Draw arrow
        doc.setFillColor(annotColor);
        drawPdfArrow(doc, tArrow, tElbow, 1.5);
        
        // Draw text
        doc.setFontSize(8);
        doc.setTextColor(annotColor);
        const textAlign = tText.x > tElbow.x ? 'left' : 'right';
        doc.text(leader.text, tText.x + (textAlign === 'left' ? 1 : -1), tText.y - 0.5, { align: textAlign });
      }
    });
  }
  
  doc.save(`${titleBlockData.detailName}.pdf`);
};
