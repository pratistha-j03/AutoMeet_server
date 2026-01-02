import express from 'express';
import Meeting from '../models/meetingModel.js'; 
import upload from '../config/multer.js';

const router = express.Router();

// POST /meetings/upload-audio
router.post('/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No audio file uploaded' });
    }

    const userId = req.body.user_id; 

    const newMeeting = new Meeting({
      user_id: userId,
      title: req.body.title || 'Untitled Meeting',
      audio_url: req.file.path,
      upload_type: 'uploaded',
      status: 'uploaded'
    });

    const meeting = await newMeeting.save();

    res.json({
      msg: 'File uploaded successfully',
      meeting_id: meeting._id,
      file_path: req.file.path
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

export default router;