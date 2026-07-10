import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import JSZip from "jszip";

export interface ReportCardNode {
  filename: string;
  node: HTMLElement;
}

/** Resolve once every <img> inside `node` has finished loading (or errored),
 *  so the logo isn't captured blank. */
function waitForImages(node: HTMLElement): Promise<void> {
  const imgs = Array.from(node.querySelectorAll("img"));
  return Promise.all(
    imgs.map(img =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>(res => {
            img.addEventListener("load", () => res(), { once: true });
            img.addEventListener("error", () => res(), { once: true });
          }),
    ),
  ).then(() => undefined);
}

/**
 * Rasterize each report-card node to a one-page PDF (fit to A4 portrait,
 * centered, aspect preserved) and bundle them into a zip. `onProgress` fires
 * after each card so the UI can show "12 / 146".
 */
export async function generateReportCardsZip(
  cards: ReportCardNode[],
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  const zip = new JSZip();

  for (let i = 0; i < cards.length; i++) {
    const { filename, node } = cards[i];
    await waitForImages(node);

    const canvas = await html2canvas(node, {
      scale: 2, // retina-sharp
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 22;
    // Fit within the printable area, preserving the card's aspect ratio.
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;
    const scale = Math.min(availW / canvas.width, availH / canvas.height);
    const drawW = canvas.width * scale;
    const drawH = canvas.height * scale;
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      (pageW - drawW) / 2,
      margin,
      drawW,
      drawH,
    );

    zip.file(filename, pdf.output("blob"));
    onProgress?.(i + 1, cards.length);
    // Yield so the progress bar repaints between cards.
    await new Promise(r => setTimeout(r, 0));
  }

  return zip.generateAsync({ type: "blob" });
}

/** Trigger a browser download of a blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // Keep the object URL alive well past the click. Revoking it synchronously
  // (as we used to) can truncate a large download that's still streaming to
  // disk — the browser cancels the read mid-flight and writes a partial file,
  // which macOS then reports as an "unsupported format" zip. Defer cleanup so
  // the whole archive lands intact regardless of size.
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}
