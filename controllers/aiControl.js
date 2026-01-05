import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import Meeting from '../models/meetingModel.js';
import ActionItem from '../models/actionModel.js';
import Transcript from '../models/transcriptModel.js';
import Summary from '../models/summaryModel.js';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import {pipeline} from 'stream/promises';
import {Readable} from 'stream';

const router = express.Router();
const getGeminiClients = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing from environment variables");

    return {
        genAI: new GoogleGenerativeAI(apiKey),
        fileManager: new GoogleAIFileManager(apiKey)
    };
};
async function updateMeetingStatus(id, status) {
    await Meeting.findByIdAndUpdate(id, { status: status });
}

router.post('/:id/transcribe', async (req, res) => {
    let tempFilePath = null;
    try {
        const { id } = req.params;
        const { genAI, fileManager } = getGeminiClients();

        const existingTranscript = await Transcript.findOne({ meetingId: id });
        if (existingTranscript) {
            console.log("Transcript found in cache. Skipping Gemini.");
            return res.status(200).json({
                message: "Transcription retrieved from cache",
                transcript: existingTranscript.rawText
            });
        }

        //  Validate Meeting & File
        const meeting = await Meeting.findById(id);
        if (!meeting.audioUrl) {
            return res.status(404).json({ error: "Meeting or audio file not found" });
        }
        console.log("Downloading audio from Cloudinary...");

        // Download audio file to temp location
        const extension = meeting.audioUrl.split('.').pop().split(/[?#]/)[0] || 'mp3';
        tempFilePath = path.resolve(`./temp_meeting_${id}.${extension}`);
        const response = await fetch(meeting.audioUrl);
        if (!response.ok) {
            throw new Error(`Failed to download audio file: ${response.statusText}`);
        }
        // Stream to local temp file
        const fileStream = fs.createWriteStream(tempFilePath);
        await pipeline(Readable.fromWeb(response.body), fileStream);
        
        console.log(`Download complete: ${tempFilePath}`);

        //  Upload to Google AI (Temporary storage for processing)
        const mimeType = extension === 'webm' ? 'audio/webm' : 'audio/mp3';
        const uploadResponse = await fileManager.uploadFile(tempFilePath, {
            mimeType: mimeType,
            displayName: `Meeting_${id}`,
        });

        //  Wait for processing (File API is async)

        //  Generate Transcript
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadResponse.file.mimeType,
                    fileUri: uploadResponse.file.uri
                }
            },
            { text: "Transcribe this audio meeting word-for-word. Identify speakers if possible. Return ONLY the raw text." }
        ]);

        const text = result.response.text();

        const newTranscript = new Transcript({
            meetingId: id,
            rawText: text,
            language: "en"
        });
        await newTranscript.save();

        //  Update Meeting Status 
        await updateMeetingStatus(id, 'transcribed');

        // Cleanup (Optional but recommended: delete file from Google servers)
        // await fileManager.deleteFile(uploadResponse.file.name);

        res.status(200).json({
            message: "Transcription successful",
            transcript: text
        });

    } catch (error) {
        console.error("Gemini Transcription Error:", error);
        res.status(500).json({ error: "Failed to transcribe audio with Gemini", details: error.message });
    }
    finally {
        //  Delete the local temp file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            console.log("Temporary file cleaned up.");
        }
    }

});

router.post('/:id/generate-summary', async (req, res) => {
    try {
        const { id } = req.params;
        const { genAI } = getGeminiClients();
        const transcriptDoc = await Transcript.findOne({ meetingId: id });

        if (!transcriptDoc) {
            return res.status(400).json({ error: "No transcription available for this meeting" });
        }
        // 1. Configure Model for JSON
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        // 2. Prompt
        const prompt = `
            Analyze this meeting transcript.
            Output a JSON object with this exact schema:
            {
                "summary": "string (executive summary)",
                "decisions": ["string", "string"],
                "action_items": [
                    { "description": "string", "owner": "string", "deadline": "string" }
                ]
            }
            
            TRANSCRIPT:
            ${transcriptDoc.rawText}
        `;

        // 3. Generate
        const result = await model.generateContent(prompt);
        const aiContent = JSON.parse(result.response.text());

        // 4. Save to Summaries Collection 
        const newSummary = new Summary({
            meetingId: id,
            summaryText: aiContent.summary,
            decisions: aiContent.decisions
        });
        await newSummary.save();

        if (aiContent.action_items && aiContent.action_items.length > 0) {
            const actionsToSave = aiContent.action_items.map(item => ({
                meetingId: id,
                description: item.description,
                owner: item.owner,
                deadline: item.deadline,
            }));
            await ActionItem.insertMany(actionsToSave);
            console.log(`Saved ${actionsToSave.length} action items.`);
        }
        res.status(200).json({
            message: "Summary generated",
            summaryId: newSummary._id,
            summary: newSummary.summaryText,
            actionItems: aiContent.action_items || []
        });
    } catch (error) {
        console.error("Gemini Summary Error:", error);
        res.status(500).json({ error: "Failed to generate summary" });
    }
});

export default router;