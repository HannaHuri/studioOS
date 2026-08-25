"use client";

import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = "/studioOS/pdf.worker.min.mjs";

export default function PdfViewer({
  file, numPages, pageWidth, onLoadSuccess,
}: {
  file: string;
  numPages: number | null;
  pageWidth: number;
  onLoadSuccess: (numPages: number) => void;
}) {
  return (
    <Document key={file} file={file} onLoadSuccess={({ numPages: n }) => onLoadSuccess(n)} loading={null}>
      {Array.from({ length: numPages ?? 0 }, (_, i) => (
        <div key={i} className="shadow-lg" style={{ maxWidth: `${pageWidth}px` }}>
          <Page pageNumber={i + 1} width={pageWidth} renderTextLayer={false} renderAnnotationLayer={false} />
        </div>
      ))}
    </Document>
  );
}
