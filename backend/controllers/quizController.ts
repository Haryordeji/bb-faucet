// backend/controllers/quizController.ts
import { Request, Response } from 'express';
import { QuestionService } from '../services/questionService';
import path from 'path';

const questionService = new QuestionService(
  process.env.DEEPSEEK_API_KEY || '',
  path.join(__dirname, '../../backend/course-materials'),
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
    try {
      const { answers, questionIds, correctAnswers } = req.body;
      
      if (!answers || !questionIds || !Array.isArray(answers) || !Array.isArray(questionIds)) {
        res.status(400).json({ error: 'Invalid request format' });
        return;
      }
      
      if (!correctAnswers || !Array.isArray(correctAnswers) || correctAnswers.length !== questionIds.length) {
        res.status(400).json({ error: 'Invalid correctAnswers format' });
        return;
      }
      
      // Validate answers and calculate score
      const results: any = [];
      let totalCorrect = 0;
      
      for (let i = 0; i < questionIds.length; i++) {
        const questionId = questionIds[i];
        const userAnswer = answers[i];
        const correctAnswer = correctAnswers[i];
        
        const isCorrect = userAnswer === correctAnswer;
        if (isCorrect) totalCorrect++;
        
        results.push({
          questionId,
          userAnswer,
          correctAnswer,
          isCorrect
        });
      }
      
      // Calculate score as a percentage
      const scorePercentage = Math.round((totalCorrect / questionIds.length) * 100);
      const isCorrect = scorePercentage >= 50; // Consider "correct" if score is at least 50%
      
      // Send the results
      res.json({
        score: scorePercentage,
        isCorrect,
        results,
        totalCorrect,
        totalQuestions: questionIds.length
      });
    } catch (error) {
      console.error('Error grading quiz:', error);
      res.status(500).json({ error: 'Failed to grade quiz' });
    }
  }
};