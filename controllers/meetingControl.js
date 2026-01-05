import express from 'express';
import Meeting from '../models/meetingModel.js';
import upload from '../config/multer.js';
import Transcript from '../models/transcriptModel.js';
import Summary from '../models/summaryModel.js';
import ActionItem from '../models/actionModel.js';

const router = express.Router();

// GET /meetings/:id
router.get('/:id', async (req, res) => {
  try {
    const {id}= req.params;
    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ msg: 'Meeting not found' });
    }
    const transcriptDoc = await Transcript.findOne({meetingId: id});
    const summaryDoc = await Summary.findOne({meetingId: id});
    const actionItems = await ActionItem.find({meetingId: id});
    const responseData = {
      ...meeting.toObject(),
      transcript: transcriptDoc ? transcriptDoc.rawText : null,
      summary: summaryDoc? {
        summaryText: summaryDoc.summaryText,
        decisions: summaryDoc.decisions || [],
        actionItems: actionItems || []
      } : null
    };
    res.json({ responseData } );
  }
  catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// POST /meetings/upload-audio
router.post('/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No audio file uploaded' });
    }

    const userId = req.body.user_id ;

    const newMeeting = new Meeting({
      user_id: userId,
      title: req.body.title || 'Untitled Meeting',
      audioUrl: req.file.path,
      uploadType: 'uploaded',
      status: 'uploaded'
    });

    const meeting = await newMeeting.save();

    res.json({
      msg: 'File uploaded successfully',
      meetingId: meeting._id,
      file_path: req.file.path
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

export default router;