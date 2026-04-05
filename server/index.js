import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { detectExerciseRoute } from './routes/detect-exercise.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.post('/api/detect-exercise', detectExerciseRoute);

// Serve Vite build output
app.use(express.static(join(__dirname, '../dist')));
app.get('/*splat', (_req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => console.log(`Fitness Former server on port ${PORT}`));
