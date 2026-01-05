import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';
dotenv.config();

// 1. Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Configure Storage Engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'automeet_uploads',
    resource_type: 'video',  
    allowed_formats: ['mp3', 'wav', 'webm', 'm4a'],
  },
});

const upload = multer({ storage: storage });
export default upload;

// Ensure the 'uploads' directory exists before trying to save files
// const uploadDir = 'uploads/';
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir);
// }

// 1. Storage Engine Configuration
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, uploadDir); 
//   },
//   filename: function (req, file, cb) {
//     // Naming convention: meeting-TIMESTAMP-ORIGINALNAME
//     // Example: meeting-1703204400000-recording.mp3
//     cb(null, 'meeting-' + Date.now() + path.extname(file.originalname));
//   }
// });

// // 2. File Filter (Strictly Audio)
// const fileFilter = (req, file, cb) => {
//   // Simple check for mime types starting with 'audio/'
//   if (file.mimetype.startsWith('audio/')) {
//     cb(null, true);
//   } else {
//     cb(new Error('Invalid file type. Only audio files are allowed.'), false);
//   }
// };

// // 3. Initialize Multer
// const upload = multer({ 
//   storage: storage, 
//   fileFilter: fileFilter,
//   limits: {
//     fileSize: 1024 * 1024 * 50 // Optional: Limit file size to 50MB
//   }
// });
