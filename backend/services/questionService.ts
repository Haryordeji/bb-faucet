// backend/services/questionService.ts
import fs from 'fs';
import path from 'path';
import axios from 'axios';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface SlideContent {
  filename: string;
  content: string;
  weekCovered: number;
}

export class QuestionService {
  private openaiApiKey: string;
  private slidesDirectory: string;
  private currentWeek: number;
  private slidesCache: SlideContent[] = [];

  constructor(
    openaiApiKey: string,
    slidesDirectory: string = path.join(__dirname, '../../course-materials'),
    currentWeek: number = 6
  ) {
    this.openaiApiKey = openaiApiKey;
    this.slidesDirectory = slidesDirectory;
    this.currentWeek = currentWeek;
    this.loadSlides();
  }

  /**
   * Set the current week to control knowledge cutoff
   */
  public setCurrentWeek(week: number): void {
    this.currentWeek = week;
  }

  public getCurrentWeek(): number {
    return this.currentWeek;
  }
    

  /**
   * Load all slides from the directory and cache them
   */
  private loadSlides(): void {
    try {
      const files = fs.readdirSync(this.slidesDirectory);
      
      this.slidesCache = files
        .filter(file => file.endsWith('.txt'))
        .map(file => {
          // Extract week number from filename (format: "week1-topic.txt")
          const weekMatch = file.match(/week(\d+)/i);
          const weekCovered = weekMatch ? parseInt(weekMatch[1]) : 1;
          
          return {
            filename: file,
            content: fs.readFileSync(path.join(this.slidesDirectory, file), 'utf-8'),
            weekCovered
          };
        });
      
      if (this.slidesCache.length === 0) {
        throw new Error('No slide files found in the directory');
      }
    } catch (error) {
      console.error('Error loading slides:', error);
      throw error;
    }
  }

  /**
   * Get a random slide that has been covered up to the current week
   */
  private getRandomSlide(): SlideContent {
    const coveredSlides = this.slidesCache.filter(
      slide => slide.weekCovered <= this.currentWeek
    );

    if (coveredSlides.length === 0) {
      throw new Error('No slides available for the current week');
    }

    const randomIndex = Math.floor(Math.random() * coveredSlides.length);
    return coveredSlides[randomIndex];
  }

  /**
   * Generate quiz questions based on a random covered slide
   */
  public async generateQuizQuestions(
    numQuestions: number = 1
  ): Promise<{ questions: QuizQuestion[]; slideTopic: string }> {
    try {
      const slide = this.getRandomSlide();
      const topic = this.extractTopicFromFilename(slide.filename);
      
      const prompt = this.createPrompt(
        slide.content,
        numQuestions,
      );

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that creates educational quiz questions about blockchain technology. Always return valid JSON format."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content;
      const questions = this.parseQuestions(content);
      
      return {
        questions,
        slideTopic: topic
      };
    } catch (error) {
      console.error('Error generating quiz questions:', error);
      throw error;
    }
  }

  /**
   * Extract topic from filename (format: "week1-blockchain-basics.txt")
   */
  private extractTopicFromFilename(filename: string): string {
    // Remove "weekX-" prefix and ".txt" suffix
    return filename
      .replace(/^week\d+-/i, '')
      .replace(/\.txt$/i, '')
      .replace(/-/g, ' ');
  }

  private createPrompt(
    slideContent: string,
    numQuestions: number
  ): string {
    return `Based on the following course material, generate ${numQuestions} 
            with a mix of difficulty level quiz questions with their answers:
            
            ${slideContent}
            
            Format the response as a JSON object with a "questions" array where each question has:
            - "question": string
            - "options": string[] (4 options)
            - "correctAnswer": string (must match one of the options exactly)
            - "explanation": string
            
            Example:
            {
              "questions": [
                {
                  "question": "What is the primary purpose of a blockchain?",
                  "options": [
                    "To store large amounts of unstructured data",
                    "To create a decentralized, tamper-resistant ledger",
                    "To replace traditional databases with faster alternatives",
                    "To serve as a platform for social media applications"
                  ],
                  "correctAnswer": "To create a decentralized, tamper-resistant ledger",
                  "explanation": "The primary purpose... explained here."
                }
              ]
            }`;
  }

  private parseQuestions(content: string): QuizQuestion[] {
    try {
      const parsed = JSON.parse(content);
      
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('Invalid response format: missing questions array');
      }
      
      // Validate each question
      parsed.questions.forEach((q: any) => {
        if (!q.question || typeof q.question !== 'string') {
          throw new Error('Invalid question: missing or invalid question text');
        }
        if (!q.options || !Array.isArray(q.options) || q.options.length !== 4) {
          throw new Error('Invalid question: options must be an array of 4 strings');
        }
        if (!q.correctAnswer || typeof q.correctAnswer !== 'string') {
          throw new Error('Invalid question: missing or invalid correctAnswer');
        }
        if (!q.explanation || typeof q.explanation !== 'string') {
          throw new Error('Invalid question: missing or invalid explanation');
        }
        if (!q.options.includes(q.correctAnswer)) {
          throw new Error('Invalid question: correctAnswer must match one of the options');
        }
      });
      
      return parsed.questions;
    } catch (error) {
      console.error('Error parsing questions:', error);
      throw new Error('Failed to parse questions from AI response');
    }
  }
}