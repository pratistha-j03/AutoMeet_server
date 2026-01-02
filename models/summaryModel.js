import mongoose from 'mongoose';
const { Schema } = mongoose;

const SummarySchema = new Schema({
  meeting_id: {
    type: Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true
  },
  summary_text: {
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