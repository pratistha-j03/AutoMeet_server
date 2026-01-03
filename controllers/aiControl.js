import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import Meeting from '../models/meetingModel.js';
import ActionItem from '../models/actionModel.js';
import Transcript from '../models/transcriptModel.js';

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
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
    try {
        const { id } = req.params;
        const { genAI, fileManager } = getGeminiClients();

        // 1. Validate Meeting & File
        const meeting = await Meeting.findById(id);
        if (!meeting) {
            return res.status(404).json({ error: "Meeting or audio file not found" });
        }

        // 2. Upload to Google AI (Temporary storage for processing)
        const uploadResponse = await fileManager.uploadFile(meeting.audioUrl, {
            mimeType: "audio/mp3",
            displayName: `Meeting_${id}`,
        });

        // 3. Wait for processing (File API is async)

        // 4. Generate Transcript
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

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
            meeting_id: id,
            raw_text: text,
            language: "en"
        });
        await newTranscript.save();

        // 4. Update Meeting Status 
        await updateMeetingStatus(id, 'transcribed');

        // 6. Cleanup (Optional but recommended: delete file from Google servers)
        // await fileManager.deleteFile(uploadResponse.file.name);

        res.status(200).json({
            message: "Transcription successful",
            transcript: transcriptionText
        });

    } catch (error) {
        console.error("Gemini Transcription Error:", error);
        res.status(500).json({ error: "Failed to transcribe audio with Gemini", details: error.message });
    }
});

router.post('/:id/generate-summary', async (req, res) => {
    try {
        const { id } = req.params;
        const { genAI } = getGeminiClients();
        const meeting = await Transcript.findById(id);

        if (!meeting) {
            return res.status(400).json({ error: "No transcription available" });
        }

        // 1. Configure Model for JSON
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-pro",
            generationConfig: { responseMimeType: "application/json" }
        });

        // 2. Prompt
        const prompt = `
            Analyze this meeting transcript.
            Output a JSON object with this exact schema:
            {
                "summary": "string (executive summary)",
                "action_items": [
                    { "description": "string", "owner": "string", "deadline": "string" }
                ]
            }
            
            TRANSCRIPT:
            ${meeting.transcription}
        `;

        // 3. Generate
        const result = await model.generateContent(prompt);
        const aiContent = JSON.parse(result.response.text());

        // 4. Save to Summaries Collection 
        const newSummary = new Summary({
            meeting_id: id,
            summary_text: aiContent.summary,
            decisions: aiContent.decisions
        });
        await newSummary.save();

        res.json({ message: "Summary generated", summaryId: newSummary._id });


    } catch (error) {
        console.error("Gemini Summary Error:", error);
        res.status(500).json({ error: "Failed to generate summary" });
    }
});

export default router;