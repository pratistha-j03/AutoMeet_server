import mongoose from 'mongoose';
const { Schema } = mongoose;

const SummarySchema = new Schema({
  meetingId: {
    type: Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true
  },
  summaryText: {
    type: String, 
    required: true
  },
  decisions: [{
    type: String 
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Summary', SummarySchema);