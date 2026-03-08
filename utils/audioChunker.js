import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';

export async function splitAudioIntoChunks(inputPath, chunkDurationSec = 600) {
    const chunks = [];
    const duration = await getAudioDuration(inputPath);
    const overlap = 30;
    for (let start = 0; start < duration; start += chunkDurationSec - overlap) {
        const chunkPath = inputPath.replace('.mp3', `_chunk_${start}.mp3`);
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
        const uploadResponse = await fileManager.uploadFile(chunk.path, {
            mimeType: 'audio/mp3',
            displayName: `chunk_${chunk.startTime}`,
        });

        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadResponse.file.mimeType,
                    fileUri: uploadResponse.file.uri
                }
            },
            { text: "Transcribe this audio meeting word-for-word. Identify speakers if possible. Return ONLY the raw text." }
        ]);

        return {
            startTime: chunk.startTime,
            text: result.response.text()
        };
    } finally {
        if(fs.existsSync(chunk.path)) {
            fs.unlinkSync(chunk.path);
        }
    }
}

export function mergeTranscripts(chunkResults){
    chunkResults.sort((a,b) => a.startTime - b.startTime);
    if(chunkResults.length===1) return chunkResults[0].text;
    let merged= chunkResults[0].text;
    for(let i=1; i<chunkResults.length; i++){
        const currentText= chunkResults[i].text;
        const tailOfPrevious = merged.slice(-200);
        const overlapIndex = findOverlapIndex(tailOfPrevious, currentText);
        if(overlapIndex!==-1){
            merged+= '\n'+ currentText.slice(overlapIndex);
        }
        else merged+= '\n'+ currentText;
    }
    return merged;
}

function findOverlapIndex(tail, currentText){
    for(let i=Math.min(tail.length, currentText.length); i>30; i-=10){
        if(currentText.indexOf(tail.slice(-i))!==-1){
            return currentText.indexOf(tail.slice(-i))+tail.slice(-i).length;
        }
    }
    return -1;
}