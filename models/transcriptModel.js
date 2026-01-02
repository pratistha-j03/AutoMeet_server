import mongoose from 'mongoose';
const { Schema } = mongoose;

const TranscriptSchema = new Schema({
  meetingId: {
    type: Schema.Types.ObjectId,
    ref: 'Meeting', 
    required: true,
  },
  rawText: {
    type: String, 
    required: true
  },
  language: {
    type: String, 
    default: 'en'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Transcript', TranscriptSchema);