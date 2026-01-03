import mongoose from 'mongoose';
const { Schema } = mongoose;

const ActionItemSchema = new Schema({
  meetingId: {
    type: Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true
  },
  description: {
    type: String, 
    required: true
  },
  owner: {
    type: String, 
    default: 'Unassigned'
  },
  deadline: {
    type: String,
    default: 'TBA'
  },
  calendar_event_id: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now 
  }
});

export default mongoose.model('ActionItem', ActionItemSchema);