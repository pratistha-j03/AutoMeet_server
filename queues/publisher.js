import { getRabbitChannel } from '../config/rabbitmq.js';
import { setJobStatus } from '../utils/jobStatus.js';

export async function publishMeetingJob(meetingId) {
    const channel = await getRabbitChannel();
    const payload = {
        meetingId,
        enqueuedAt: new Date().toISOString()
    };

    channel.sendToQueue(
        'meeting_processing',
        Buffer.from(JSON.stringify(payload)),
        { persistent: true } 
    );
    // Immediately mark as queued in Redis
    await setJobStatus(meetingId, 'queued');
    console.log(`[Publisher] Job queued for meeting: ${meetingId}`);
}