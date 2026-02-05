export type Point = {
  x: number;
  y: number;
};

export type SnapType = 'endpoint' | 'midpoint' | 'center';

export type SnapPoint = {
  point: Point;
  type: SnapType;
};

export type Tool = 'select' | 'pan' | 'line' | 'circle' | 'rectangle' | 'dimension';

// --- Shapes ---
interface BaseShape {
  id: string;
  layerId: string;
}

export interface Line extends BaseShape {
  type: 'line';
  p1: Point;
  p2: Point;
}

export interface Circle extends BaseShape {
  type: 'circle';
  center: Point;
  radius: number;
}

export interface Rectangle extends BaseShape {
  type: 'rectangle';
  p1: Point; // Top-left corner
  p2: Point; // Bottom-right corner
}

export type Shape = Line | Circle | Rectangle;

// --- Dimensions ---
export interface Dimension {
    id: string;
    layerId: 'dimensions';
    p1: Point;
    p2: Point;
    offset: number;
    text?: string;
}

// --- Layer ---
export interface Layer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

// --- Main State ---
export interface DrawingState {
  shapes: Shape[];
  dimensions: Dimension[];
  layers: Layer[];
}

export interface TitleBlockData {
    detailName: string;
    material: string;
    thickness: string;
    author: string;
    date: string;
}

// FIX: Add types for the File System Access API to the global Window object.
// This resolves errors where properties like `showSaveFilePicker` and `showOpenFilePicker`
// were not found on the `Window` type.
interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
  getFile(): Promise<File>;
  readonly name: string;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  close(): Promise<void>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: {
    description?: string;
    accept: Record<string, string[]>;
  }[];
}

interface OpenFilePickerOptions {
    types?: {
        description: string;
        accept: Record<string, string[]>;
    }[];
    multiple?: boolean;
}

declare global {
  interface Window {
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
    showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
  }
}
