import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authControl from './controllers/authControl.js';
import meetingControl from './controllers/meetingControl.js';
import aiControl from './controllers/aiControl.js';

dotenv.config();

const app = express();
const allowedOrigins = [
  "http://localhost:5173",
  "https://automeet-client.vercel.app" 
];
app.use(cors({origin: allowedOrigins}));
connectDB(); 

app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/auth', authControl);
app.use('/meetings', meetingControl);
app.use('/ai', aiControl);

app.get('/', (req, res) => {
  res.send('AutoMeet Server is running');
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));