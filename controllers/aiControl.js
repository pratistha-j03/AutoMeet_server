import express from 'express';
import Meeting from '../models/meetingModel.js';
import auth from '../middleware/auth.js';
import { publishMeetingJob } from '../queues/publisher.js';
import { getJobStatus } from '../utils/jobStatus.js';

const router = express.Router();

router.post('/:id/process', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const meeting = await Meeting.findById(id);
        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
        if (!meeting.audioUrl) return res.status(400).json({ error: 'No audio uploaded yet' });

        await publishMeetingJob(id);
        res.status(202).json({ message: 'Processing started', meetingId: id });

    } catch (err) {
        console.error('[Process] Full error object:', err);        // ← the whole thing
        console.error('[Process] Error type:', typeof err);        // ← what type is it
        console.error('[Process] Error message:', err?.message);   // ← safe access
        console.error('[Process] Error stack:', err?.stack);
        res.status(500).json({ error: 'Failed to queue meeting for processing' });
    }
});

router.get('/:id/status', auth, async (req, res) => {
    try {
        const status = await getJobStatus(req.params.id);
        if (!status) return res.status(404).json({ error: 'Job not found' });
        res.json(status);

    } catch (err) {
        console.error('[Status] Error:', err.message);
        res.status(500).json({ error: 'Failed to retrieve job status' });
    }
});

export default router;