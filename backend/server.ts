// backend/server.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { quizController } from './controllers/quizController';
import { claimController } from './controllers/claimController';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Quiz routes
app.get('/api/quiz/generate', (req: Request, res: Response) => quizController.generateQuiz(req, res));
app.post('/api/quiz/submit', (req: Request, res: Response) => quizController.submitAnswers(req, res));

// Claim routes
app.get('/api/claim/status/:userAddress', (req: Request, res: Response) => claimController.getClaimStatus(req, res));
app.post('/api/claim/initiate', (req: Request, res: Response) => claimController.initiateClaim(req, res));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;