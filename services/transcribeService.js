import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import Meeting from '../models/meetingModel.js';
import Transcript from '../models/transcriptModel.js';
import { getAudioDuration, splitAudioIntoChunks, transcribeChunk, mergeTranscripts } from '../utils/audioChunker.js';
import { withRetry } from '../utils/retry.js';

export async function runTranscription(meetingId) {
    let tempFilePath = null;
    let chunkPaths = [];
    try {
        const existing = await Transcript.findOne({ meetingId });
        if (existing) {
            console.log(`[Transcribe] Cache hit for ${meetingId}`);
            return existing.rawText;
        }

        const meeting = await Meeting.findById(meetingId);
        if (!meeting?.audioUrl) throw new Error('Audio URL not found');

        const apiKey = process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        const fileManager = new GoogleAIFileManager(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const extension = meeting.audioUrl.split('.').pop().split(/[?#]/)[0] || 'mp3';
        tempFilePath = path.resolve(`./temp_meeting_${meetingId}.${extension}`);
        const mimeType = extension === 'webm' ? 'audio/webm' : 'audio/mp3';

        const response = await fetch(meeting.audioUrl);
        if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);
        await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(tempFilePath));
        const duration = await getAudioDuration(tempFilePath);
        let text;

        if (duration > 2700) {
            const chunks = await splitAudioIntoChunks(tempFilePath);
            chunkPaths = chunks.map(c => c.path);
            const results = await Promise.all(
                chunks.map(chunk => transcribeChunk(chunk, fileManager, model, mimeType))
            );
            text = mergeTranscripts(results);
        } else {
            const uploadResponse = await withRetry(
                () => fileManager.uploadFile(tempFilePath, { mimeType, displayName: `Meeting_${meetingId}` }),
                { label: `upload ${meetingId}` }
            );
            const result = await withRetry(
                () => model.generateContent([
                    { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
                    { text: 'Transcribe this audio meeting word-for-word. Identify speakers if possible. Return ONLY the raw text.' }
                ]),
                { label: `transcribe ${meetingId}` }
            );
            text = result.response.text();
        }

        await new Transcript({ meetingId, rawText: text, language: 'en' }).save();
        await Meeting.findByIdAndUpdate(meetingId, { status: 'transcribed' });
        return text;

    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        chunkPaths.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
    }
}