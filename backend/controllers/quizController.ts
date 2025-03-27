import { Request, Response } from 'express';
import { QuestionService } from '../services/questionService';
import path from 'path';

const questionService = new QuestionService(
  process.env.OPENAI_API_KEY || '',
  path.join(__dirname, '../../course-materials'),
  parseInt(process.env.CURRENT_WEEK || '1')
);

export const quizController = {
  generateQuiz: async (req: Request, res: Response) => {
    try {
      // Optionally allow override of week via query param
      if (req.query.week) {
        questionService.setCurrentWeek(parseInt(req.query.week as string));
      }

      const { questions, slideTopic } = await questionService.generateQuizQuestions(
        parseInt(req.query.numQuestions as string) || 1
        );

      res.json({ 
        questions,
        metadata: {
          slideTopic,
          currentWeek: questionService.getCurrentWeek()
        }
      });
    } catch (error) {
      console.error('Error generating quiz:', error);
      res.status(500).json({ error: 'Failed to generate quiz questions' });
    }
  },

  submitAnswers: async (req: Request, res: Response) => {
    // TODO: A way to submit and grade the quiz
  }
};