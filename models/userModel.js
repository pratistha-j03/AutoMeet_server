import mongoose from 'mongoose';
const { Schema } = mongoose;

const UserSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  calendar_provider: {
    type: String,
    enum: ['google',]
  },
  calendar_refresh_token: {
    type: String,
    select: false // Security: Exclude this field by default in queries
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('User', UserSchema);