const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const WIDTH = 1024;
const HEIGHT = 1024;

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const length = data.length;
  const chunk = Buffer.alloc(8 + length + 4);
  chunk.writeUInt32BE(length, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  chunk.writeUInt32BE(crc >>> 0, 8 + length);
  return chunk;
}

function setPixel(data, x, y, color) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const idx = (y * WIDTH + x) * 4;
  data[idx] = color[0];
  data[idx + 1] = color[1];
  data[idx + 2] = color[2];
  data[idx + 3] = color[3];
}

function fillRect(data, x, y, w, h, color) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(WIDTH, x + w);
  const y1 = Math.min(HEIGHT, y + h);
  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) {
      setPixel(data, xx, yy, color);
    }
  }
}

function drawLine(data, x0, y0, x1, y1, thickness, color) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    for (let ox = -thickness; ox <= thickness; ox += 1) {
      for (let oy = -thickness; oy <= thickness; oy += 1) {
        setPixel(data, x0 + ox, y0 + oy, color);
      }
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function generate() {
  const data = new Uint8Array(WIDTH * HEIGHT * 4);

  const bg = [248, 250, 252, 255];
  const panel = [255, 255, 255, 255];
  const border = [226, 232, 240, 255];
  const text = [51, 65, 85, 255];
  const accent = [22, 163, 74, 255];
  const muted = [148, 163, 184, 255];

  fillRect(data, 0, 0, WIDTH, HEIGHT, bg);

  // Left status bar
  fillRect(data, 0, 0, 56, HEIGHT, accent);

  // Main card area
  fillRect(data, 96, 120, 860, 784, panel);
  fillRect(data, 96, 120, 860, 4, border);
  fillRect(data, 96, 900, 860, 4, border);
  fillRect(data, 96, 120, 4, 784, border);
  fillRect(data, 952, 120, 4, 784, border);

  // Checkbox square
  fillRect(data, 140, 200, 90, 90, panel);
  fillRect(data, 140, 200, 90, 4, border);
  fillRect(data, 140, 286, 90, 4, border);
  fillRect(data, 140, 200, 4, 90, border);
  fillRect(data, 226, 200, 4, 90, border);

  // Checkmark
  drawLine(data, 160, 245, 185, 270, 5, accent);
  drawLine(data, 185, 270, 220, 220, 5, accent);

  // List lines
  fillRect(data, 260, 220, 560, 14, text);
  fillRect(data, 260, 320, 520, 12, muted);
  fillRect(data, 260, 400, 460, 12, muted);
  fillRect(data, 260, 480, 520, 12, muted);

  // Secondary checkboxes
  fillRect(data, 150, 310, 70, 70, panel);
  fillRect(data, 150, 310, 70, 4, border);
  fillRect(data, 150, 376, 70, 4, border);
  fillRect(data, 150, 310, 4, 70, border);
  fillRect(data, 216, 310, 4, 70, border);

  fillRect(data, 150, 390, 70, 70, panel);
  fillRect(data, 150, 390, 70, 4, border);
  fillRect(data, 150, 456, 70, 4, border);
  fillRect(data, 150, 390, 4, 70, border);
  fillRect(data, 216, 390, 4, 70, border);

  fillRect(data, 150, 470, 70, 70, panel);
  fillRect(data, 150, 470, 70, 4, border);
  fillRect(data, 150, 536, 70, 4, border);
  fillRect(data, 150, 470, 4, 70, border);
  fillRect(data, 216, 470, 4, 70, border);

  // Manifesto ribbon
  fillRect(data, 96, 620, 860, 80, [30, 64, 175, 255]);
  fillRect(data, 120, 642, 560, 12, [226, 232, 240, 255]);
  fillRect(data, 120, 668, 420, 12, [226, 232, 240, 255]);

  const rows = [];
  for (let y = 0; y < HEIGHT; y += 1) {
    const row = Buffer.alloc(1 + WIDTH * 4);
    row[0] = 0; // no filter
    for (let x = 0; x < WIDTH; x += 1) {
      const idx = (y * WIDTH + x) * 4;
      row[1 + x * 4] = data[idx];
      row[1 + x * 4 + 1] = data[idx + 1];
      row[1 + x * 4 + 2] = data[idx + 2];
      row[1 + x * 4 + 3] = data[idx + 3];
    }
    rows.push(row);
  }

  const imageData = Buffer.concat(rows);
  const compressed = zlib.deflateSync(imageData, { level: 9 });

  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // color type RGBA
  header[10] = 0; // compression
  header[11] = 0; // filter
  header[12] = 0; // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ];

  const output = Buffer.concat(chunks);
  const outPath = path.join(__dirname, '..', 'build', 'icon.png');
  fs.writeFileSync(outPath, output);
  console.log(`Icon written to ${outPath}`);
}

generate();
