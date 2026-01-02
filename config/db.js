import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const URI = process.env.MONGO_URI;
    await mongoose.connect(URI);

    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

export default connectDB;