import { splitTextIntoChunks } from "../utils/textChunker.js";
import Transcript from '../models/transcriptModel.js';
import Summary from '../models/summaryModel.js';
import Meeting from '../models/meetingModel.js';
import ActionItem from '../models/actionModel.js';
import { GoogleGenerativeAI } from '@google/generative-ai'; 

export async function summarizeShortText(model, transcriptText) {
    console.log(`Short transcript (${transcriptText.length} chars). Using single-stage summarization...`);
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
            ${transcriptText}
        `;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
}

export async function summarizeLongText(plainModel, transcriptText, jsonModel) {
    console.log('[Summarize] transcriptText type:', typeof transcriptText);
    console.log('[Summarize] transcriptText preview:', String(transcriptText).slice(0, 100));
    const chunks = splitTextIntoChunks(transcriptText, 12000);
    console.log(`Transcript split into ${chunks.length} chunks for summarization.`);
    const miniSummaries = await Promise.all(
        chunks.map(async (chunk, i) => {
            const result = await plainModel.generateContent(`
                You are summarizing segment ${i + 1} of ${chunks.length} from a meeting transcript.
                Extract the key points, decisions, and any action items mentioned.
                Be concise. Return plain text, not JSON.            
                SEGMENT:
                ${chunk}
            `);
            console.log(`Step 2: chunk ${i + 1}/${chunks.length} done`);
            return result.response.text();
        })
    );

    console.log(` combining ${miniSummaries.length} summaries...`);
    const reducePrompt = `
        You have ${miniSummaries.length} summaries from different segments of the same meeting.
        Synthesize them into a single coherent output.
        Output ONLY a JSON object with this exact schema:
        {
            "summary": "string (executive summary of the full meeting)",
            "decisions": ["string", "string"],
            "action_items": [
                { "description": "string", "owner": "string", "deadline": "string" }
            ]
        }
        Remove duplicates. Merge related action items. Be concise.
        SEGMENT SUMMARIES:
        ${miniSummaries.map((s, i) => `--- Segment ${i + 1} ---\n${s}`).join('\n\n')}
    `;

    const finalResult = await jsonModel.generateContent(reducePrompt);
    return JSON.parse(finalResult.response.text());
}

export async function runSummarization(meetingId) {
    const transcriptDoc = await Transcript.findOne({ meetingId });
    if (!transcriptDoc) throw new Error('No transcript found');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: 'application/json' } });
    const plainModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const aiContent = transcriptDoc.rawText.length > 24000
        ? await summarizeLongText(plainModel, model, transcriptDoc.rawText)
        : await summarizeShortText(model, transcriptDoc.rawText);

    const newSummary = await new Summary({
        meetingId,
        summaryText: aiContent.summary,
        decisions: aiContent.decisions
    }).save();

    if (aiContent.action_items?.length > 0) {
        await ActionItem.insertMany(
            aiContent.action_items.map(item => ({ meetingId, ...item }))
        );
    }

    await Meeting.findByIdAndUpdate(meetingId, { status: 'completed' });
    return newSummary;
}