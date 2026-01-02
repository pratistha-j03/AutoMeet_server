import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authControl from './controllers/authControl.js';
import meetingControl from './controllers/meetingControl.js';

dotenv.config();

const app = express();
connectDB(); 

app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/auth', authControl);
app.use('/meetings', meetingControl);

app.get('/', (req, res) => {
  res.send('AutoMeet Server is running');
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));