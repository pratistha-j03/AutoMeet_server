import mongoose from 'mongoose';
const { Schema } = mongoose;

const MeetingSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User', 
    // required: true
  },
  title: {
    type: String,
    default: 'Untitled Meeting',
    trim: true
  },
  audioUrl: {
    type: String, 
    // required: true
  },
  uploadType: {
    type: String,
    enum: ['recorded', 'uploaded'], 
    // required: true
  },
  status: {
    type: String,
    enum: ['uploaded', 'transcribed', 'processed', 'completed', 'failed'],
    default: 'uploaded'
  },
  createdAt: {
    type: Date,
    default: Date.now 
  }
});

export default mongoose.model('Meeting', MeetingSchema);