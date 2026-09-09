const PREVIEW_WIDTH = 196;
const PREVIEW_HEIGHT = 50;

function drawPreview(count: number) {
  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_WIDTH;
  canvas.height = PREVIEW_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = "rgba(24, 24, 27, 0.97)";
  context.strokeStyle = "rgba(82, 82, 91, 0.95)";
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(0.5, 0.5, PREVIEW_WIDTH - 1, PREVIEW_HEIGHT - 1, 8);
  context.fill();
  context.stroke();

  context.fillStyle = "rgba(74, 222, 128, 0.14)";
  context.beginPath();
  context.roundRect(10, 9, 32, 32, 6);
  context.fill();

  context.strokeStyle = "#4ade80";
  context.lineWidth = 1.6;
  context.strokeRect(22, 16, 12, 16);
  context.strokeRect(18, 19, 12, 16);

  context.fillStyle = "#f4f4f5";
  context.font = "600 14px system-ui, sans-serif";
  context.textBaseline = "middle";
  context.fillText(`${count} ${count === 1 ? "livro" : "livros"}`, 54, PREVIEW_HEIGHT / 2);
  return canvas;
}

export function createBookDragPreview(count: number): string | undefined {
  try {
    return drawPreview(count)?.toDataURL("image/png");
  } catch {
    return undefined;
  }
}

export function setBookDragImage(dataTransfer: DataTransfer, count: number) {
  try {
    const canvas = drawPreview(count);
    if (!canvas) return;
    canvas.style.position = "fixed";
    canvas.style.left = "-10000px";
    canvas.style.top = "-10000px";
    canvas.style.pointerEvents = "none";
    document.body.appendChild(canvas);
    dataTransfer.setDragImage(canvas, 24, 25);
    window.setTimeout(() => canvas.remove(), 0);
  } catch {
    // The browser-provided drag image remains a safe fallback.
  }
}
