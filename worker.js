import 'dotenv/config';
import mongoose from 'mongoose';
import { getRabbitChannel } from './config/rabbitmq.js';
import { setJobStatus } from './utils/jobStatus.js';
import { runTranscription } from './services/transcribeService.js';
import { runSummarization } from './services/summarizeService.js';

const MAX_RETRIES = 3;

async function processJob(msg, channel) {
    const { meetingId } = JSON.parse(msg.content.toString());
    const retryCount = (msg.properties.headers?.['x-retry-count'] || 0);

    console.log(`[Worker] Processing meeting: ${meetingId} (attempt ${retryCount + 1}/${MAX_RETRIES})`);

    try {
        await setJobStatus(meetingId, 'transcribing');
        await runTranscription(meetingId);

        await setJobStatus(meetingId, 'summarizing');
        await runSummarization(meetingId);

        await setJobStatus(meetingId, 'completed');
        console.log(`[Worker] Meeting ${meetingId} completed.`);
        channel.ack(msg); 
    } catch (err) {
        console.error(`[Worker] Failed for meeting ${meetingId}:`, err.message);
        if (retryCount < MAX_RETRIES - 1) {
            console.warn(`[Worker] Requeueing (retry ${retryCount + 1}/${MAX_RETRIES})...`);
            const delay = 1000 * Math.pow(2, retryCount);
            await new Promise(r => setTimeout(r, delay));

            channel.sendToQueue(
                'meeting_processing',
                msg.content,
                {
                    persistent: true,
                    headers: { 'x-retry-count': retryCount + 1 }
                }
            );
            channel.ack(msg);
        } else {
            // Max retries hit — send to Dead Letter Queue
            console.error(`[Worker] Meeting ${meetingId} sent to DLQ after ${MAX_RETRIES} attempts.`);
            await setJobStatus(meetingId, 'failed', { error: err.message });
            channel.nack(msg, false, false);
        }
    }
}

async function startWorker() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Worker] MongoDB connected.');
    const channel = await getRabbitChannel();
    channel.prefetch(1); 
    console.log('[Worker] Waiting for jobs...');
    channel.consume('meeting_processing', (msg) => {
        if (msg) processJob(msg, channel);
    });
}

startWorker().catch(err => {
    console.error('[Worker] Fatal startup error:', err);
    process.exit(1);
});