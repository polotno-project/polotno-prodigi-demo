import React from 'react';
import ReactDOM from 'react-dom/client';
import { PolotnoContainer, SidePanelWrap, WorkspaceWrap } from 'polotno';
import { Toolbar } from 'polotno/toolbar/toolbar';
import { ZoomButtons } from 'polotno/toolbar/zoom-buttons';
import { SidePanel, DEFAULT_SECTIONS } from 'polotno/side-panel';
import { Workspace } from 'polotno/canvas/workspace';
import { createStore } from 'polotno/model/store';

import { prodigiSection } from './prodigi-section';

// A framed print editor with a Prodigi tab. Prodigi's classic framed print
// (GLOBAL-CFPM-16X20) is 40 × 50 cm and takes a 3600 × 4800 px file, so the
// canvas is exactly that, shown in centimetres.

const WIDTH_PX = 3600;
const HEIGHT_PX = 4800;
const WIDTH_CM = 40;
const HEIGHT_CM = 50;

// Polotno SDK needs an API key: a trial key from https://polotno.com/cabinet
// works for trying this; production use needs a paid license.
const store = createStore({ key: import.meta.env.VITE_POLOTNO_KEY, showCredit: false });
window.store = store;

store.setUnit({ unit: 'cm', dpi: WIDTH_PX / (WIDTH_CM / 2.54) });
store.setSize(WIDTH_PX, HEIGHT_PX);
const page = store.addPage();

// A starter print.
const W = store.width;
const H = store.height;
page.set({ background: '#efe9df' });
page.addElement({
  type: 'figure',
  subType: 'circle',
  x: W * 0.2,
  y: H * 0.16,
  width: W * 0.6,
  height: W * 0.6,
  fill: '#2f5d50',
});
page.addElement({
  type: 'figure',
  subType: 'rect',
  x: W * 0.12,
  y: H * 0.5,
  width: W * 0.76,
  height: H * 0.012,
  fill: '#c9733d',
});
page.addElement({
  type: 'text',
  text: 'Slow Mornings',
  x: W * 0.1,
  y: H * 0.68,
  width: W * 0.8,
  fontSize: W * 0.1,
  fontFamily: 'Playfair Display',
  fill: '#2b2b2b',
  align: 'center',
});
page.addElement({
  type: 'text',
  text: 'Framed fine art print · 40 × 50 cm',
  x: W * 0.15,
  y: H * 0.86,
  width: W * 0.7,
  fontSize: W * 0.028,
  fontFamily: 'Roboto',
  fill: '#2b2b2b',
  align: 'center',
});
store.selectElements([]);

// Only what a print needs: no generic templates, no resize (the size is fixed
// by the product), no drawing.
const sections = [
  prodigiSection({ widthCm: WIDTH_CM, heightCm: HEIGHT_CM, widthPx: WIDTH_PX, heightPx: HEIGHT_PX }),
  ...DEFAULT_SECTIONS.filter((s) =>
    ['text', 'photos', 'elements', 'upload', 'background', 'layers'].includes(s.name)
  ),
];

const App = () => (
  <PolotnoContainer style={{ width: '100vw', height: '100vh' }}>
    <SidePanelWrap>
      <SidePanel store={store} sections={sections} defaultSection="prodigi" />
    </SidePanelWrap>
    <WorkspaceWrap>
      <Toolbar store={store} downloadButtonEnabled />
      <Workspace store={store} />
      <ZoomButtons store={store} />
    </WorkspaceWrap>
  </PolotnoContainer>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
