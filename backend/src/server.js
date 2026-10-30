import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import photogrammetryRoutes from './routes/photoGrammetryRoute.js';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend integration
app.use(cors());

// Parse incoming JSON payloads
app.use(express.json());

// Register API Routes
app.use('/api/photogrammetry', photogrammetryRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 Photogrammetry Backend Server running on port ${PORT}`);
});