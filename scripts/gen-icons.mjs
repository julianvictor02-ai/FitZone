// Erzeugt die PWA-/iOS-Icons (dependency-frei, nur node:zlib). Weißes Hantel-Symbol
// auf FitZone-Pinie-Grün. Neu erzeugen: `node scripts/gen-icons.mjs`.
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(td), 0);
  return Buffer.concat([len, td, crc]);
}

function png(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// Hantel in 512er-Koordinaten (mittig, im sicheren Bereich für Maskable-Icons).
const RECTS_512 = [
  [190, 240, 322, 272], // Stange
  [158, 210, 190, 302], // linke innere Scheibe
  [128, 226, 158, 286], // linke äußere Scheibe
  [322, 210, 354, 302], // rechte innere Scheibe
  [354, 226, 384, 286], // rechte äußere Scheibe
];
const BG = [0x1f, 0x5c, 0x46, 0xff];
const FG = [0xff, 0xff, 0xff, 0xff];

function draw(size) {
  const s = size / 512;
  const rects = RECTS_512.map((r) => r.map((v) => v * s));
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let c = BG;
      for (const [x1, y1, x2, y2] of rects) {
        if (x >= x1 && x < x2 && y >= y1 && y < y2) {
          c = FG;
          break;
        }
      }
      const i = (y * size + x) * 4;
      rgba[i] = c[0];
      rgba[i + 1] = c[1];
      rgba[i + 2] = c[2];
      rgba[i + 3] = c[3];
    }
  }
  return rgba;
}

mkdirSync("public/icons", { recursive: true });
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  writeFileSync(`public/icons/${name}`, png(size, draw(size)));
  console.log("geschrieben public/icons/" + name);
}
