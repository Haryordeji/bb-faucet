// backend/controllers/quizController.ts
import { Request, Response } from 'express';
import { QuestionService } from '../services/questionService';
import path from 'path';
import dotenv from "dotenv";
dotenv.config();

const questionService = new QuestionService(
  process.env.DEEPSEEK_API_KEY!,
  path.join(__dirname, '../artifacts/course-materials'),
  parseInt(process.env.CURRENT_WEEK || '1')
);

export const quizController = {
  generateQuiz: async (req: Request, res: Response) => {
    try {
      // Optionally allow override of week via query param
      if (req.query.week) {
        questionService.setCurrentWeek(parseInt(req.query.week as string));
      }

      const { questions, freeResponseQuestion, slideTopic } = await questionService.generateQuizQuestions(
        parseInt(req.query.numQuestions as string) || 5
      );

      res.json({ 
        questions,
        freeResponseQuestion,
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
      const { 
        answers, 
        questionIds, 
        correctAnswers, 
        freeResponseAnswer,
        freeResponseQuestion,
        freeResponseRubric
      } = req.body;
      
      if (!answers || !questionIds || !Array.isArray(answers) || !Array.isArray(questionIds)) {
        res.status(400).json({ error: 'Invalid request format' });
        return;
      }
      
      if (!correctAnswers || !Array.isArray(correctAnswers) || correctAnswers.length !== questionIds.length) {
        res.status(400).json({ error: 'Invalid correctAnswers format' });
        return;
      }
      
      if (!freeResponseAnswer || !freeResponseQuestion || !freeResponseRubric) {
        res.status(400).json({ error: 'Missing free response data' });
        return;
      }
      
      // Validate multiple choice answers and calculate score
      const mcResults: any = [];
      let totalCorrect = 0;
      
      for (let i = 0; i < questionIds.length; i++) {
        const questionId = questionIds[i];
        const userAnswer = answers[i];
        const correctAnswer = correctAnswers[i];
        
        const isCorrect = userAnswer === correctAnswer;
        if (isCorrect) totalCorrect++;
        
        mcResults.push({
          questionId,
          userAnswer,
          correctAnswer,
          isCorrect
        });
      }
      
      // Calculate multiple choice score as a percentage
      const mcScorePercentage = Math.round((totalCorrect / questionIds.length) * 100);
      
      // Grade the free response answer
      const frResult = await questionService.gradeFreeResponseAnswer(
        freeResponseQuestion,
        freeResponseRubric,
        freeResponseAnswer
      );
      
      // Calculate the final score (80% from multiple choice, 20% from free response)
      const finalScore = Math.round((mcScorePercentage * 0.8) + (frResult.score * 0.2));
      const isCorrect = finalScore >= 50; // Consider "correct" if score is at least 50%
      
      // Send the results
      res.json({
        score: finalScore,
        isCorrect,
        multipleChoice: {
          results: mcResults,
          totalCorrect,
          totalQuestions: questionIds.length,
          score: mcScorePercentage
        },
        freeResponse: {
          score: frResult.score,
          feedback: frResult.feedback
        }
      });
    } catch (error) {
      console.error('Error grading quiz:', error);
      res.status(500).json({ error: 'Failed to grade quiz' });
    }
  }
};