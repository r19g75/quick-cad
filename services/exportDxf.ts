
import { DrawingState, TitleBlockData, Shape, Layer } from '../types';

class DxfWriter {
  private content: string = '';

  add(code: number, value: string | number) {
    this.content += `${code}\n${value}\n`;
  }

  section(name: string) {
    this.add(0, 'SECTION');
    this.add(2, name);
  }

  endSection() {
    this.add(0, 'ENDSEC');
  }

  table(name: string) {
    this.add(0, 'TABLE');
    this.add(2, name);
  }

  endTable() {
    this.add(0, 'ENDTAB');
  }

  entity(type: string, layer: string) {
    this.add(0, type);
    this.add(8, layer); // Layer name
  }

  point(codePrefix: number, x: number, y: number, z: number = 0) {
    this.add(codePrefix, x);
    this.add(codePrefix + 10, y);
    this.add(codePrefix + 20, z);
  }

  getContent() {
    return this.content;
  }
}

export const exportToDxf = (
  drawingState: DrawingState,
  titleBlockData: TitleBlockData
) => {
  const writer = new DxfWriter();

  // Header
  writer.section('HEADER');
  writer.add(9, '$ACADVER');
  writer.add(1, 'AC1009'); // AutoCAD R12/LT2 DXF
  writer.endSection();

  // Tables (Layers)
  writer.section('TABLES');
  writer.table('LTYPE');
  writer.add(0, 'LTYPE'); writer.add(2, 'CONTINUOUS'); writer.add(70, 64); writer.add(3, 'Solid line'); writer.add(72, 65); writer.add(73, 0); writer.add(40, 0.0);
  writer.endTable();

  writer.table('LAYER');
  drawingState.layers.forEach((layer, index) => {
    writer.add(0, 'LAYER');
    writer.add(2, layer.name); // Layer name
    writer.add(70, 0); // Flags
    writer.add(62, index + 1); // Color number (1=red, 2=yellow, etc.)
    writer.add(6, 'CONTINUOUS'); // Linetype
  });
  writer.endTable();
  writer.endSection();

  // Entities
  writer.section('ENTITIES');
  drawingState.shapes.forEach(shape => {
    const layer = drawingState.layers.find(l => l.id === shape.layerId);
    if (!layer || !layer.visible) return;

    switch (shape.type) {
      case 'line':
        writer.entity('LINE', layer.name);
        writer.point(10, shape.p1.x, shape.p1.y);
        writer.point(11, shape.p2.x, shape.p2.y);
        break;
      case 'circle':
        writer.entity('CIRCLE', layer.name);
        writer.point(10, shape.center.x, shape.center.y);
        writer.add(40, shape.radius); // Radius
        break;
      case 'rectangle':
        // DXF doesn't have a rectangle entity, so we draw 4 lines
        const {p1, p2} = shape;
        const p3 = {x: p2.x, y: p1.y};
        const p4 = {x: p1.x, y: p2.y};
        const lines = [ [p1,p3], [p3,p2], [p2,p4], [p4,p1] ];
        lines.forEach(line => {
            writer.entity('LINE', layer.name);
            writer.point(10, line[0].x, line[0].y);
            writer.point(11, line[1].x, line[1].y);
        });
        break;
    }
  });
  writer.endSection();

  // EOF
  writer.add(0, 'EOF');

  const blob = new Blob([writer.getContent()], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${titleBlockData.detailName}.dxf`;
  a.click();
  URL.revokeObjectURL(url);
};
