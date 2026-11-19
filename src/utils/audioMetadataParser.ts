export interface ParsedAudioTags {
  title?: string;
  artist?: string;
  album?: string;
  trackNumber?: number;
  lyrics?: string;
  artworkBytes?: Uint8Array;
  artworkMime?: string;
}

function readSynchsafeInt(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function readUint24BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  );
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    ((bytes[offset + 3] << 24) >>> 0)
  );
}

export function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  // GIF: GIF8
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return 'image/gif';
  }
  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  // BMP: BM
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }
  return null;
}

function findImageSignatureOffset(bytes: Uint8Array, start: number): number {
  const limit = Math.min(bytes.length - 4, start + 512);
  for (let i = Math.max(0, start); i <= limit; i++) {
    if (
      (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) ||
      (bytes[i] === 0x89 &&
        bytes[i + 1] === 0x50 &&
        bytes[i + 2] === 0x4e &&
        bytes[i + 3] === 0x47) ||
      (bytes[i] === 0x47 &&
        bytes[i + 1] === 0x49 &&
        bytes[i + 2] === 0x46 &&
        bytes[i + 3] === 0x38) ||
      (bytes[i] === 0x52 &&
        bytes[i + 1] === 0x49 &&
        bytes[i + 2] === 0x46 &&
        bytes[i + 3] === 0x46)
    ) {
      return i;
    }
  }
  return -1;
}

function undoId3Unsynchronisation(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  let w = 0;
  for (let i = 0; i < bytes.length; i++) {
    out[w++] = bytes[i];
    if (bytes[i] === 0xff && i + 1 < bytes.length && bytes[i + 1] === 0x00) {
      i += 1;
    }
  }
  return out.subarray(0, w);
}

function decodeText(bytes: Uint8Array, encodingByte: number): string {
  try {
    if (encodingByte === 0) {
      return new TextDecoder('iso-8859-1')
        .decode(bytes)
        .replace(/\0+$/g, '')
        .trim();
    }
    if (encodingByte === 1) {
      return new TextDecoder('utf-16')
        .decode(bytes)
        .replace(/\0+$/g, '')
        .trim();
    }
    if (encodingByte === 2) {
      return new TextDecoder('utf-16be')
        .decode(bytes)
        .replace(/\0+$/g, '')
        .trim();
    }
    return new TextDecoder('utf-8')
      .decode(bytes)
      .replace(/^\uFEFF/, '')
      .replace(/\0+$/g, '')
      .trim();
  } catch {
    return new TextDecoder('utf-8', { fatal: false })
      .decode(bytes)
      .replace(/^\uFEFF/, '')
      .replace(/\0+$/g, '')
      .trim();
  }
}

function findNullTerminator(
  bytes: Uint8Array,
  start: number,
  isUtf16: boolean
): number {
  if (!isUtf16) {
    for (let i = start; i < bytes.length; i++) {
      if (bytes[i] === 0) return i;
    }
    return bytes.length;
  }
  for (let i = start; i + 1 < bytes.length; i += 2) {
    if (bytes[i] === 0 && bytes[i + 1] === 0) return i;
  }
  return bytes.length;
}

function extractApicPayload(
  payload: Uint8Array,
  declaredMime: string,
  descStart: number,
  isUtf16: boolean
): { bytes: Uint8Array; mime: string } | null {
  if (descStart >= payload.length) return null;

  const descEnd = findNullTerminator(payload, descStart, isUtf16);
  const imgStart = descEnd + (isUtf16 ? 2 : 1);

  if (imgStart < payload.length) {
    const candidate = payload.subarray(imgStart);
    const detected = detectImageMime(candidate);
    if (detected) {
      return {
        bytes: candidate.slice(),
        mime: declaredMime.startsWith('image/') ? declaredMime : detected,
      };
    }
  }

  const sigOffset = findImageSignatureOffset(payload, descStart);
  if (sigOffset >= 0 && sigOffset < payload.length) {
    const candidate = payload.subarray(sigOffset);
    const detected = detectImageMime(candidate);
    if (detected) {
      return {
        bytes: candidate.slice(),
        mime: detected,
      };
    }
  }

  return null;
}

function parseId3v2(bytes: Uint8Array): ParsedAudioTags | null {
  if (
    bytes.length < 10 ||
    bytes[0] !== 0x49 || // I
    bytes[1] !== 0x44 || // D
    bytes[2] !== 0x33 // 3
  ) {
    return null;
  }

  const version = bytes[3];
  const flags = bytes[5];
  const tagUnsync = (flags & 0x80) !== 0;
  const tagSize = readSynchsafeInt(bytes, 6);
  let tagBytes = bytes.subarray(10, Math.min(bytes.length, 10 + tagSize));
  if (tagUnsync && version < 4) {
    tagBytes = undoId3Unsynchronisation(tagBytes);
  }

  let pos = 0;
  if (version >= 3 && (flags & 0x40) !== 0 && pos + 4 <= tagBytes.length) {
    const extSize =
      version === 4
        ? readSynchsafeInt(tagBytes, pos)
        : readUint32BE(tagBytes, pos);
    pos += version === 4 ? extSize : 4 + extSize;
  }

  const result: ParsedAudioTags = {};
  const asciiDecoder = new TextDecoder('iso-8859-1');
  let artworkPriority = -1;

  if (version === 2) {
    while (pos + 6 <= tagBytes.length) {
      const frameId = asciiDecoder.decode(tagBytes.subarray(pos, pos + 3));
      if (!/^[A-Z0-9]{3}$/.test(frameId)) break;
      const frameSize = readUint24BE(tagBytes, pos + 3);
      pos += 6;
      if (frameSize <= 0 || pos + frameSize > tagBytes.length) break;
      const payload = tagBytes.subarray(pos, pos + frameSize);
      pos += frameSize;

      if (frameId === 'TT2' && payload.length > 1) {
        const val = decodeText(payload.subarray(1), payload[0]);
        if (val) result.title = val;
      } else if (frameId === 'TP1' && payload.length > 1) {
        const val = decodeText(payload.subarray(1), payload[0]);
        if (val) result.artist = val;
      } else if (frameId === 'TAL' && payload.length > 1) {
        const val = decodeText(payload.subarray(1), payload[0]);
        if (val) result.album = val;
      } else if (frameId === 'TRK' && payload.length > 1) {
        const raw = decodeText(payload.subarray(1), payload[0]);
        const n = parseInt(raw.split('/')[0], 10);
        if (Number.isFinite(n) && n > 0) result.trackNumber = n;
      } else if (frameId === 'ULT' && payload.length > 5 && !result.lyrics) {
        const enc = payload[0];
        const isUtf16 = enc === 1 || enc === 2;
        const descEnd = findNullTerminator(payload, 4, isUtf16);
        const textStart = Math.min(payload.length, descEnd + (isUtf16 ? 2 : 1));
        const text = decodeText(payload.subarray(textStart), enc);
        if (text) result.lyrics = text;
      } else if (frameId === 'PIC' && payload.length > 6) {
        const enc = payload[0];
        const isUtf16 = enc === 1 || enc === 2;
        const fmt = asciiDecoder.decode(payload.subarray(1, 4)).toUpperCase();
        const picType = payload[4];
        const declaredMime =
          fmt === 'PNG' ? 'image/png' : fmt === 'JPG' ? 'image/jpeg' : '';
        const extracted = extractApicPayload(payload, declaredMime, 5, isUtf16);
        if (extracted && (artworkPriority < 0 || picType === 3)) {
          result.artworkBytes = extracted.bytes;
          result.artworkMime = extracted.mime;
          artworkPriority = picType === 3 ? 3 : 1;
        }
      }
    }
    return result;
  }

  while (pos + 10 <= tagBytes.length) {
    const frameId = asciiDecoder.decode(tagBytes.subarray(pos, pos + 4));
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

    let frameSize =
      version === 4
        ? readSynchsafeInt(tagBytes, pos + 4)
        : readUint32BE(tagBytes, pos + 4);

    if (
      version === 4 &&
      (tagBytes[pos + 4] > 0x7f ||
        tagBytes[pos + 5] > 0x7f ||
        tagBytes[pos + 6] > 0x7f ||
        tagBytes[pos + 7] > 0x7f ||
        (pos + 10 + frameSize + 4 <= tagBytes.length &&
          tagBytes[pos + 10 + frameSize] !== 0 &&
          !/^[A-Z0-9]{4}$/.test(
            asciiDecoder.decode(
              tagBytes.subarray(
                pos + 10 + frameSize,
                pos + 10 + frameSize + 4
              )
            )
          )))
    ) {
      const beSize = readUint32BE(tagBytes, pos + 4);
      if (beSize > 0 && pos + 10 + beSize <= tagBytes.length) {
        frameSize = beSize;
      }
    }

    const frameFlag2 = tagBytes[pos + 9];
    pos += 10;

    if (frameSize <= 0 || pos + frameSize > tagBytes.length) break;
    let payload = tagBytes.subarray(pos, pos + frameSize);
    pos += frameSize;

    if (version === 4 && (frameFlag2 & 0x01) !== 0 && payload.length > 4) {
      payload = payload.subarray(4);
    }
    if (version === 4 && (tagUnsync || (frameFlag2 & 0x02) !== 0)) {
      payload = undoId3Unsynchronisation(payload);
    }

    if (frameId === 'TIT2' && payload.length > 1) {
      const val = decodeText(payload.subarray(1), payload[0]);
      if (val) result.title = val;
    } else if (frameId === 'TPE1' && payload.length > 1) {
      const val = decodeText(payload.subarray(1), payload[0]);
      if (val) result.artist = val;
    } else if (frameId === 'TALB' && payload.length > 1) {
      const val = decodeText(payload.subarray(1), payload[0]);
      if (val) result.album = val;
    } else if (frameId === 'TRCK' && payload.length > 1) {
      const raw = decodeText(payload.subarray(1), payload[0]);
      const parsed = parseInt(raw.split('/')[0], 10);
      if (Number.isFinite(parsed) && parsed > 0) result.trackNumber = parsed;
    } else if (frameId === 'USLT' && payload.length > 5 && !result.lyrics) {
      const encoding = payload[0];
      const isUtf16 = encoding === 1 || encoding === 2;
      const descEnd = findNullTerminator(payload, 4, isUtf16);
      const textStart = Math.min(payload.length, descEnd + (isUtf16 ? 2 : 1));
      const text = decodeText(payload.subarray(textStart), encoding);
      if (text) result.lyrics = text;
    } else if (frameId === 'SYLT' && payload.length > 7) {
      const encoding = payload[0];
      const isUtf16 = encoding === 1 || encoding === 2;
      const timeStampFormat = payload[4]; // 2 = ms
      if (timeStampFormat === 2) {
        let p = findNullTerminator(payload, 6, isUtf16) + (isUtf16 ? 2 : 1);
        const lrcLines: string[] = [];
        while (p < payload.length) {
          const textEnd = findNullTerminator(payload, p, isUtf16);
          const lineText = decodeText(payload.subarray(p, textEnd), encoding);
          p = textEnd + (isUtf16 ? 2 : 1);
          if (p + 4 > payload.length) break;
          const ms = readUint32BE(payload, p);
          p += 4;
          const totalSec = ms / 1000;
          const mins = Math.floor(totalSec / 60);
          const secs = (totalSec % 60).toFixed(2).padStart(5, '0');
          lrcLines.push(`[${String(mins).padStart(2, '0')}:${secs}]${lineText}`);
        }
        if (lrcLines.length > 0) {
          result.lyrics = lrcLines.join('\n');
        }
      }
    } else if (frameId === 'APIC' && payload.length > 4) {
      const encoding = payload[0];
      const isUtf16 = encoding === 1 || encoding === 2;
      const mimeEnd = findNullTerminator(payload, 1, false);
      const declaredMime = asciiDecoder
        .decode(payload.subarray(1, mimeEnd))
        .trim();
      if (declaredMime === '-->') continue;
      const picTypePos = mimeEnd + 1;
      if (picTypePos + 1 < payload.length) {
        const picType = payload[picTypePos];
        const descStart = picTypePos + 1;
        const extracted = extractApicPayload(
          payload,
          declaredMime,
          descStart,
          isUtf16
        );
        if (
          extracted &&
          (artworkPriority < 0 || (picType === 3 && artworkPriority < 3))
        ) {
          result.artworkBytes = extracted.bytes;
          result.artworkMime = extracted.mime;
          artworkPriority = picType === 3 ? 3 : 1;
        }
      }
    }
  }

  return result;
}

function parseFlacPictureBlock(
  block: Uint8Array
): { bytes: Uint8Array; mime: string; picType: number } | null {
  if (block.length <= 32) return null;
  const utf8 = new TextDecoder('utf-8');
  const picType = readUint32BE(block, 0);
  let pp = 4;
  const mimeLen = readUint32BE(block, pp);
  pp += 4;
  if (pp + mimeLen > block.length) return null;
  const mime = utf8.decode(block.subarray(pp, pp + mimeLen)).trim();
  if (mime === '-->') return null;
  pp += mimeLen;
  if (pp + 4 > block.length) return null;
  const descLen = readUint32BE(block, pp);
  pp += 4 + descLen + 16;
  if (pp + 4 > block.length) return null;
  const dataLen = readUint32BE(block, pp);
  pp += 4;
  if (dataLen <= 0 || pp + dataLen > block.length) return null;
  const imgBytes = block.slice(pp, pp + dataLen);
  const detected = detectImageMime(imgBytes);
  if (!detected) return null;
  return {
    bytes: imgBytes,
    mime: mime.startsWith('image/') ? mime : detected,
    picType,
  };
}

function decodeBase64ToBytes(b64: string): Uint8Array | null {
  try {
    const clean = b64.replace(/\s+/g, '');
    if (typeof atob === 'function') {
      const bin = atob(clean);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        arr[i] = bin.charCodeAt(i);
      }
      return arr;
    }
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(clean, 'base64'));
    }
    return null;
  } catch {
    return null;
  }
}

function parseVorbisCommentPayload(
  block: Uint8Array,
  offset: number,
  result: ParsedAudioTags,
  state: { artworkPriority: number }
): void {
  const utf8 = new TextDecoder('utf-8');
  let vp = offset;
  if (vp + 4 > block.length) return;
  const vendorLen = readUint32LE(block, vp);
  vp += 4 + vendorLen;
  if (vp + 4 > block.length) return;
  const commentCount = readUint32LE(block, vp);
  vp += 4;
  for (let i = 0; i < commentCount && vp + 4 <= block.length; i++) {
    const cLen = readUint32LE(block, vp);
    vp += 4;
    if (vp + cLen > block.length) break;
    const entry = utf8.decode(block.subarray(vp, vp + cLen));
    vp += cLen;
    const eq = entry.indexOf('=');
    if (eq > 0) {
      const k = entry.slice(0, eq).trim().toUpperCase();
      const v = entry.slice(eq + 1).trim();
      if (k === 'TITLE' && v) result.title = v;
      else if (k === 'ARTIST' && v) result.artist = v;
      else if (k === 'ALBUM' && v) result.album = v;
      else if (k === 'TRACKNUMBER' && v) {
        const n = parseInt(v.split('/')[0], 10);
        if (Number.isFinite(n) && n > 0) result.trackNumber = n;
      } else if (
        (k === 'LYRICS' ||
          k === 'UNSYNCEDLYRICS' ||
          k === 'SYNCEDLYRICS') &&
        v &&
        !result.lyrics
      ) {
        result.lyrics = v;
      } else if (k === 'METADATA_BLOCK_PICTURE' && v) {
        const rawPic = decodeBase64ToBytes(v);
        if (rawPic) {
          const parsedPic = parseFlacPictureBlock(rawPic);
          if (
            parsedPic &&
            (state.artworkPriority < 0 ||
              (parsedPic.picType === 3 && state.artworkPriority < 3))
          ) {
            result.artworkBytes = parsedPic.bytes;
            result.artworkMime = parsedPic.mime;
            state.artworkPriority = parsedPic.picType === 3 ? 3 : 1;
          }
        }
      }
    }
  }
}

function parseFlac(bytes: Uint8Array): ParsedAudioTags | null {
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x66 || // f
    bytes[1] !== 0x4c || // L
    bytes[2] !== 0x61 || // a
    bytes[3] !== 0x43 // C
  ) {
    return null;
  }

  const result: ParsedAudioTags = {};
  const state = { artworkPriority: -1 };
  let pos = 4;
  let isLast = false;

  while (!isLast && pos + 4 <= bytes.length) {
    const header = bytes[pos];
    isLast = (header & 0x80) !== 0;
    const blockType = header & 0x7f;
    const blockLen = readUint24BE(bytes, pos + 1);
    pos += 4;
    if (pos + blockLen > bytes.length) break;
    const block = bytes.subarray(pos, pos + blockLen);
    pos += blockLen;

    if (blockType === 4 && block.length >= 8) {
      parseVorbisCommentPayload(block, 0, result, state);
    } else if (blockType === 6) {
      const pic = parseFlacPictureBlock(block);
      if (
        pic &&
        (state.artworkPriority < 0 ||
          (pic.picType === 3 && state.artworkPriority < 3))
      ) {
        result.artworkBytes = pic.bytes;
        result.artworkMime = pic.mime;
        state.artworkPriority = pic.picType === 3 ? 3 : 1;
      }
    }
  }

  return result;
}

function parseOgg(bytes: Uint8Array): ParsedAudioTags | null {
  if (
    bytes.length < 28 ||
    bytes[0] !== 0x4f || // O
    bytes[1] !== 0x67 || // g
    bytes[2] !== 0x67 || // g
    bytes[3] !== 0x53 // S
  ) {
    return null;
  }

  const packetChunks: Uint8Array[] = [];
  let totalCollected = 0;
  let pos = 0;
  let pagesSeen = 0;

  while (
    pos + 27 <= bytes.length &&
    pagesSeen < 64 &&
    totalCollected < 8 * 1024 * 1024
  ) {
    if (
      bytes[pos] !== 0x4f ||
      bytes[pos + 1] !== 0x67 ||
      bytes[pos + 2] !== 0x67 ||
      bytes[pos + 3] !== 0x53
    ) {
      break;
    }
    const segCount = bytes[pos + 26];
    if (pos + 27 + segCount > bytes.length) break;
    let bodySize = 0;
    for (let i = 0; i < segCount; i++) {
      bodySize += bytes[pos + 27 + i];
    }
    const bodyStart = pos + 27 + segCount;
    if (bodyStart + bodySize > bytes.length) break;
    packetChunks.push(bytes.subarray(bodyStart, bodyStart + bodySize));
    totalCollected += bodySize;
    pos = bodyStart + bodySize;
    pagesSeen += 1;
  }

  const stream = new Uint8Array(totalCollected);
  let writePos = 0;
  for (const chunk of packetChunks) {
    stream.set(chunk, writePos);
    writePos += chunk.length;
  }

  const ascii = new TextDecoder('iso-8859-1');
  const result: ParsedAudioTags = {};
  const state = { artworkPriority: -1 };

  for (let i = 0; i + 8 < stream.length; i++) {
    if (
      stream[i] === 0x03 &&
      stream[i + 1] === 0x76 &&
      stream[i + 2] === 0x6f &&
      stream[i + 3] === 0x72 &&
      stream[i + 4] === 0x62 &&
      stream[i + 5] === 0x69 &&
      stream[i + 6] === 0x73
    ) {
      parseVorbisCommentPayload(stream, i + 7, result, state);
      return result;
    }
    if (
      stream[i] === 0x4f && // O
      stream[i + 1] === 0x70 && // p
      stream[i + 2] === 0x75 && // u
      stream[i + 3] === 0x73 && // s
      ascii.decode(stream.subarray(i, i + 8)) === 'OpusTags'
    ) {
      parseVorbisCommentPayload(stream, i + 8, result, state);
      return result;
    }
  }

  return result;
}

function parseMp4Atoms(
  bytes: Uint8Array,
  start: number,
  end: number,
  result: ParsedAudioTags
): void {
  const ascii = new TextDecoder('iso-8859-1');
  const utf8 = new TextDecoder('utf-8');
  let pos = start;

  while (pos + 8 <= end) {
    let size = readUint32BE(bytes, pos);
    const type = ascii.decode(bytes.subarray(pos + 4, pos + 8));
    let headerSize = 8;
    if (size === 1 && pos + 16 <= end) {
      size = readUint32BE(bytes, pos + 12);
      headerSize = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < headerSize || pos + size > end) break;

    const payloadStart = pos + headerSize;
    const atomEnd = pos + size;

    if (type === 'moov' || type === 'udta' || type === 'ilst') {
      parseMp4Atoms(bytes, payloadStart, atomEnd, result);
    } else if (type === 'meta' && payloadStart + 4 < atomEnd) {
      const probeNoSkip = ascii.decode(
        bytes.subarray(payloadStart + 4, payloadStart + 8)
      );
      const hasFullBoxHeader =
        probeNoSkip !== 'hdlr' && probeNoSkip !== 'ilst';
      parseMp4Atoms(
        bytes,
        hasFullBoxHeader ? payloadStart + 4 : payloadStart,
        atomEnd,
        result
      );
    } else if (
      type === '\xa9nam' ||
      type === '\xa9ART' ||
      type === '\xa9alb' ||
      type === '\xa9lyr' ||
      type === 'trkn' ||
      type === 'covr'
    ) {
      let inner = payloadStart;
      while (inner + 16 <= atomEnd) {
        const dSize = readUint32BE(bytes, inner);
        const dType = ascii.decode(bytes.subarray(inner + 4, inner + 8));
        if (dSize < 16 || inner + dSize > atomEnd) break;
        if (dType === 'data') {
          const dataFlags = readUint32BE(bytes, inner + 8) & 0x00ffffff;
          const valBytes = bytes.subarray(inner + 16, inner + dSize);
          if (type === '\xa9nam') {
            result.title = utf8.decode(valBytes).trim();
          } else if (type === '\xa9ART') {
            result.artist = utf8.decode(valBytes).trim();
          } else if (type === '\xa9alb') {
            result.album = utf8.decode(valBytes).trim();
          } else if (type === '\xa9lyr' && !result.lyrics) {
            result.lyrics = utf8.decode(valBytes).trim();
          } else if (type === 'trkn' && valBytes.length >= 4) {
            const trk = (valBytes[2] << 8) | valBytes[3];
            if (trk > 0) result.trackNumber = trk;
          } else if (
            type === 'covr' &&
            !result.artworkBytes &&
            valBytes.length > 0
          ) {
            const detected = detectImageMime(valBytes);
            if (detected) {
              result.artworkBytes = valBytes.slice();
              result.artworkMime =
                dataFlags === 14
                  ? 'image/png'
                  : dataFlags === 13
                  ? 'image/jpeg'
                  : detected;
            }
          }
          break;
        }
        inner += dSize;
      }
    }

    pos = atomEnd;
  }
}

export function parseAudioBinaryTags(buffer: ArrayBuffer): ParsedAudioTags {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) return {};

  const id3 = parseId3v2(bytes);
  if (id3) return id3;

  const flac = parseFlac(bytes);
  if (flac) return flac;

  const ogg = parseOgg(bytes);
  if (ogg) return ogg;

  const ascii = new TextDecoder('iso-8859-1');
  if (ascii.decode(bytes.subarray(4, 8)) === 'ftyp') {
    const mp4Result: ParsedAudioTags = {};
    parseMp4Atoms(bytes, 0, bytes.length, mp4Result);
    return mp4Result;
  }

  return {};
}

async function findMp4MoovSlice(blob: Blob): Promise<Blob | null> {
  const ascii = new TextDecoder('iso-8859-1');
  let offset = 0;
  let steps = 0;

  while (offset + 8 <= blob.size && steps < 64) {
    steps += 1;
    const hdr = new Uint8Array(
      await blob.slice(offset, Math.min(blob.size, offset + 16)).arrayBuffer()
    );
    if (hdr.length < 8) break;
    let size = readUint32BE(hdr, 0);
    const type = ascii.decode(hdr.subarray(4, 8));
    if (size === 1 && hdr.length >= 16) {
      const hi = readUint32BE(hdr, 8);
      const lo = readUint32BE(hdr, 12);
      size = hi * 0x100000000 + lo;
    } else if (size === 0) {
      size = blob.size - offset;
    }
    if (size < 8) break;
    if (type === 'moov') {
      const capped = Math.min(size, 16 * 1024 * 1024);
      return blob.slice(offset, Math.min(blob.size, offset + capped));
    }
    offset += size;
  }
  return null;
}

export async function extractAudioMetadataFromBlob(
  blob: Blob
): Promise<ParsedAudioTags> {
  try {
    const probeSize = Math.min(blob.size, 64 * 1024);
    const probeBuf = await blob.slice(0, probeSize).arrayBuffer();
    const probeBytes = new Uint8Array(probeBuf);

    if (
      probeBytes.length >= 10 &&
      probeBytes[0] === 0x49 &&
      probeBytes[1] === 0x44 &&
      probeBytes[2] === 0x33
    ) {
      const tagSize = readSynchsafeInt(probeBytes, 6);
      const needed = Math.min(blob.size, Math.min(16 * 1024 * 1024, 10 + tagSize));
      const fullBuf =
        needed <= probeBytes.length
          ? probeBuf
          : await blob.slice(0, needed).arrayBuffer();
      return parseAudioBinaryTags(fullBuf);
    }

    if (
      probeBytes.length >= 4 &&
      probeBytes[0] === 0x66 &&
      probeBytes[1] === 0x4c &&
      probeBytes[2] === 0x61 &&
      probeBytes[3] === 0x43
    ) {
      const headLen = Math.min(blob.size, 12 * 1024 * 1024);
      const headBuf =
        headLen <= probeBytes.length
          ? probeBuf
          : await blob.slice(0, headLen).arrayBuffer();
      return parseAudioBinaryTags(headBuf);
    }

    if (
      probeBytes.length >= 4 &&
      probeBytes[0] === 0x4f &&
      probeBytes[1] === 0x67 &&
      probeBytes[2] === 0x67 &&
      probeBytes[3] === 0x53
    ) {
      const headLen = Math.min(blob.size, 8 * 1024 * 1024);
      const headBuf =
        headLen <= probeBytes.length
          ? probeBuf
          : await blob.slice(0, headLen).arrayBuffer();
      return parseAudioBinaryTags(headBuf);
    }

    const sig = new TextDecoder('iso-8859-1').decode(
      probeBytes.subarray(4, 8)
    );
    if (sig === 'ftyp') {
      const moovSlice = await findMp4MoovSlice(blob);
      if (moovSlice) {
        const moovBuf = await moovSlice.arrayBuffer();
        const mp4Result: ParsedAudioTags = {};
        const moovBytes = new Uint8Array(moovBuf);
        parseMp4Atoms(moovBytes, 0, moovBytes.length, mp4Result);
        return mp4Result;
      }
    }

    const fallbackLen = Math.min(blob.size, 4 * 1024 * 1024);
    const fallbackBuf =
      fallbackLen <= probeBytes.length
        ? probeBuf
        : await blob.slice(0, fallbackLen).arrayBuffer();
    return parseAudioBinaryTags(fallbackBuf);
  } catch {
    return {};
  }
}
