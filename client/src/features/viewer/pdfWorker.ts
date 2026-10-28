import { pdfjs } from 'react-pdf';

// pdf.js parses files in a web worker; Vite bundles the worker from the pdfjs-dist react-pdf was built against.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
