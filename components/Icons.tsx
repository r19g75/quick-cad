
import React from 'react';

// FIX: Replaced React.FC with a standard function component definition and updated it to accept all SVG props.
// The previous definition did not allow passing props like `transform` and may have contributed to type-related issues.
const SvgIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    {props.children}
  </svg>
);

export const SelectIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></SvgIcon>;
// FIX: Replaced rotated line with a direct path for a clearer diagonal line icon.
export const LineIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19L19 5" /></SvgIcon>;
export const CircleIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></SvgIcon>;
export const RectangleIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" /></SvgIcon>;
export const DimensionIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1m0-8v1m0-8v1m16 8v1m0-8v1m0-8v1M12 4h1m-8 16h1m14 0h1M4 12h16" /></SvgIcon>;
export const SaveIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3l-4-4-4 4z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7v4h-6V7h6z" /></SvgIcon>;
export const SaveAsIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3l-4-4-4 4z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11v6m3-3h-6" /></SvgIcon>;
export const LoadIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></SvgIcon>;
export const ZoomInIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></SvgIcon>;
export const ZoomOutIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></SvgIcon>;
// FIX: Replaced confusing transformed straight arrow with a standard curved arrow for Undo.
export const UndoIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></SvgIcon>;
// FIX: Replaced incorrect straight arrow with a standard curved arrow for Redo.
export const RedoIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" /></SvgIcon>;
export const TrashIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></SvgIcon>;
export const VisibleIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></SvgIcon>;
export const HiddenIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a10.05 10.05 0 015.393-6.218M15.536 4.464A10.052 10.052 0 0118.998 12c-1.274 4.057-5.064 7-9.542 7-1.536 0-3.003-.44-4.32-1.215m14.04-14.04L4.95 19.05" /></SvgIcon>;
export const LockedIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></SvgIcon>;
export const UnlockedIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /><path d="M15 7a4 4 0 00-4-4" /></SvgIcon>;
export const AutoDimensionIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 16.5l.409-.957a.75.75 0 011.332 0l.41.957m-1.74-4.243l1.15-2.291a.75.75 0 011.332 0l1.15 2.291m-3.414 4.5l-1.15 2.291a.75.75 0 01-1.332 0l-1.15-2.291M15.75 6.75l-1.15 2.291a.75.75 0 01-1.332 0l-1.15-2.291M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></SvgIcon>;
export const AutoDimensionAllIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.06 18.5l.53-1.196a.75.75 0 011.42 0l.53 1.196m-2.26-4.773l1.29-2.58a.75.75 0 011.42 0l1.29 2.58m-3.8-5.042l-1.29 2.58a.75.75 0 01-1.42 0l-1.29-2.58" /></SvgIcon>;
export const PrintPreviewIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></SvgIcon>;
export const TextIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 6v2m16-2v2M9 6v12m0 0H7m2 0h2" /></SvgIcon>;
export const LeaderIcon = () => <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19l7-7m0 0h8m-8 0l-2-2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19l1.5-1.5" fill="currentColor" /></SvgIcon>;
