import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { withRetry } from './retry.js';

export async function splitAudioIntoChunks(inputPath, chunkDurationSec = 600) {
    const chunks = [];
    const duration = await getAudioDuration(inputPath);
    const overlap = 30;
    const inputFilename = path.basename(inputPath, path.extname(inputPath));
    const inputDir = path.dirname(inputPath);
    const inputExt = path.extname(inputPath);
    for (let start = 0; start < duration; start += chunkDurationSec - overlap) {
        const chunkPath = path.join(inputDir, `_chunk_${inputFilename}_${start}${inputExt}`);
        await new Promise((res, rej) => {
            ffmpeg(inputPath)
                .setStartTime(start)
                .setDuration(chunkDurationSec)
                .output(chunkPath)
                .on('end', res)
                .on('error', rej)
                .run();
        });
        chunks.push({ path: chunkPath, startTime: start });
    }
    return chunks;
}

export function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata.format.duration);
        });
    });
}

export async function transcribeChunk(chunk, fileManager, model) {
    try {
        const ext = path.extname(chunk.path).toLowerCase();
        const actualMimeType = ext === '.webm' ? 'audio/webm' :
            ext === '.mp4' ? 'audio/mp4' : 'audio/mp3';
        const uploadResponse = await withRetry(() => fileManager.uploadFile(chunk.path, {
            mimeType: actualMimeType,
            displayName: `chunk_${chunk.startTime}`,
        }),
            { label: `upload chunk at ${chunk.startTime}s` });

        const result = await withRetry(()=> model.generateContent([
            {
                fileData: {
                    mimeType: uploadResponse.file.mimeType,
                    fileUri: uploadResponse.file.uri
                }
            },
            { text: "Transcribe this audio meeting word-for-word. Identify speakers if possible. Return ONLY the raw text." }
        ]),
        {label: `transcribe chunk at ${chunk.startTime}s`});
        const raw = result?.response?.text();
        const text = typeof raw === 'string' ? raw.trim() : '';

        console.log(`[Transcribe] Chunk @ ${chunk.startTime}s — got ${text.length} chars`);
        return {
            startTime: chunk.startTime,
            text
        };
    } finally {
        if (fs.existsSync(chunk.path)) {
            fs.unlinkSync(chunk.path);
        }
    }
}

export function mergeTranscripts(chunkResults) {
    chunkResults.sort((a, b) => a.startTime - b.startTime);
    const validChunks = chunkResults.filter(chunk => {
        if (!chunk.text || typeof chunk.text !== 'string') {
            console.warn(`[Merge] Skipping chunk @ ${chunk.startTime}s — invalid text:`, chunk.text);
            return false;
        }
        return true;
    });

    if (validChunks.length === 0) throw new Error('No valid transcript chunks returned from Gemini');
    let merged = validChunks[0].text;
    for (let i = 1; i < validChunks.length; i++) {
        const currentText = validChunks[i].text;
        const tailOfPrevious = merged.slice(-200);
        const overlapIndex = findOverlapIndex(tailOfPrevious, currentText);
        if (overlapIndex !== -1) {
            merged += '\n' + currentText.slice(overlapIndex);
        }
        else merged += '\n' + currentText;
    }
    return merged;
}

function findOverlapIndex(tail, currentText) {
    for (let i = Math.min(tail.length, currentText.length); i > 30; i -= 10) {
        if (currentText.indexOf(tail.slice(-i)) !== -1) {
            return currentText.indexOf(tail.slice(-i)) + tail.slice(-i).length;
        }
    }
    return -1;
}