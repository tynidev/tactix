/**
 * Validates and attempts to repair audio blobs.
 * Checks for common corruption patterns like missing headers or garbage data.
 */
export interface AudioValidationResult
{
  isValid: boolean;
  error?: string;
  repairedBlob?: Blob;
  originalWasValid: boolean;
}

export const validateAudioBlob = async (blob: Blob): Promise<AudioValidationResult> =>
{
  try
  {
    if (blob.size === 0)
    {
      return { isValid: false, error: 'Recording is empty (0 bytes)', originalWasValid: false };
    }

    // Read the first 4KB to check for signatures
    const headerSize = Math.min(4096, blob.size);
    const headerBuffer = await blob.slice(0, headerSize).arrayBuffer();
    const headerView = new Uint8Array(headerBuffer);

    // Helper to find sequence in buffer
    const findSequence = (buffer: Uint8Array, sequence: number[]) =>
    {
      for (let i = 0; i < buffer.length - sequence.length; i++)
      {
        let match = true;
        for (let j = 0; j < sequence.length; j++)
        {
          if (buffer[i + j] !== sequence[j])
          {
            match = false;
            break;
          }
        }
        if (match) return i;
      }
      return -1;
    };

    // Signatures
    const webmSig = [0x1A, 0x45, 0xDF, 0xA3];
    const webmSigMissingFirst = [0x45, 0xDF, 0xA3];
    const mp4Sig = [0x66, 0x74, 0x79, 0x70]; // ftyp
    const oggSig = [0x4F, 0x67, 0x67, 0x53]; // OggS

    // 1. Check for valid WebM at start
    const webmOffset = findSequence(headerView, webmSig);
    if (webmOffset === 0)
    {
      return { isValid: true, originalWasValid: true };
    }

    // 2. Check for WebM with garbage at start
    if (webmOffset > 0)
    {
      console.warn(`Audio validation: Found WebM signature at offset ${webmOffset}. Repairing...`);
      const repairedBlob = blob.slice(webmOffset);
      return {
        isValid: true,
        repairedBlob,
        originalWasValid: false,
        error: 'Fixed garbage data at start of recording',
      };
    }

    // 3. Check for missing first byte (0x1A)
    const missingByteOffset = findSequence(headerView, webmSigMissingFirst);
    if (missingByteOffset === 0)
    {
      console.warn('Audio validation: Found WebM signature missing first byte. Repairing...');
      const missingByte = new Uint8Array([0x1A]);
      const repairedBlob = new Blob([missingByte, blob], { type: blob.type || 'audio/webm' });
      return {
        isValid: true,
        repairedBlob,
        originalWasValid: false,
        error: 'Fixed missing header byte',
      };
    }

    // 4. Check for MP4/M4A (ftyp)
    if (findSequence(headerView, mp4Sig) !== -1)
    {
      console.warn('Audio validation: Detected MP4/M4A format. Adjusting MIME type...');
      const repairedBlob = new Blob([blob], { type: 'audio/mp4' });
      return {
        isValid: true,
        repairedBlob,
        originalWasValid: false,
        error: 'Fixed incorrect audio format (MP4)',
      };
    }

    // 5. Check for Ogg (OggS)
    if (findSequence(headerView, oggSig) !== -1)
    {
      console.warn('Audio validation: Detected Ogg format. Adjusting MIME type...');
      const repairedBlob = new Blob([blob], { type: 'audio/ogg' });
      return {
        isValid: true,
        repairedBlob,
        originalWasValid: false,
        error: 'Fixed incorrect audio format (Ogg)',
      };
    }

    // If we get here, no valid signature was found
    const headerHex = Array.from(headerView.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.error(`Audio validation failed. Header: ${headerHex}`);

    return {
      isValid: false,
      error: 'Unknown audio format or corrupted recording',
      originalWasValid: false,
    };
  }
  catch (e)
  {
    console.error('Audio validation error:', e);
    return { isValid: false, error: 'Failed to validate recording', originalWasValid: false };
  }
};
