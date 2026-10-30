import express from 'express';
import multer from 'multer';
import { analyzeImage } from '../controllers/photoGrammetryController.js';

const router = express.Router();

// 1. Configure Multer to store uploaded files in RAM memory as Buffers
const storage = multer.memoryStorage();

// 2. Define File Filter to restrict uploads to image formats
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Only JPEG, PNG, and WEBP images are supported.'
      ),
      false
    );
  }
};

// 3. Initialize Multer instance with 10MB file size limit safeguard
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
});

/**
 * @route   POST /api/photogrammetry/analyze
 * @desc    Upload an image for Gemini Vision photogrammetry anchor & keypoint detection
 * @access  Public
 */
router.post('/analyze', upload.single('image'), analyzeImage);

// 4. Custom Error Handling Middleware for Multer file size/type errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum allowed size is 10 MB.',
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload Error: ${error.message}`,
    });
  } else if (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
  next();
});

export default router;