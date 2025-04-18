// backend/services/questionService.ts
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface FreeResponseQuestion {
  question: string;
  sampleAnswer: string;
  rubric: string; // Grading criteria
}

interface SlideContent {
  filename: string;
  content: string;
  weekCovered: number;
}

export class QuestionService {
  private deepseekApiKey: string;
  private slidesDirectory: string;
  private currentWeek: number;
  private slidesCache: SlideContent[] = [];
  private openai: OpenAI;

  constructor(
    deepseekApiKey: string,
    slidesDirectory: string = path.join(__dirname, '../artifacts/course-materials'),
    currentWeek: number = 6
  ) {
    this.deepseekApiKey = deepseekApiKey;
    this.slidesDirectory = slidesDirectory;
    this.currentWeek = currentWeek;
    
    // Initialize the OpenAI client with DeepSeek configuration
    this.openai = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: this.deepseekApiKey
    });
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
      console.log('Loading slides from:', this.slidesDirectory);
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
    numQuestions: number = 5
  ): Promise<{ 
    questions: QuizQuestion[]; 
    freeResponseQuestion: FreeResponseQuestion; 
    slideTopic: string 
  }> {
    try {
      const slide = this.getRandomSlide();
      const topic = this.extractTopicFromFilename(slide.filename);
      
      // Generate multiple choice questions
      const prompt = this.createPrompt(
        slide.content,
        numQuestions,
      );

      const completion = await this.openai.chat.completions.create({
        model: "deepseek-chat",
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
      });

      const content = completion.choices[0].message.content || '';
      const questions = this.parseQuestions(content);
      
      // Generate free response question
      const freeResponseQuestion = await this.generateFreeResponseQuestion(slide.content);
      
      return {
        questions,
        freeResponseQuestion,
        slideTopic: topic
      };
    } catch (error) {
      console.error('Error generating quiz questions:', error);
      throw error;
    }
  }

  /**
   * Generate a free response question based on slide content
   */
  public async generateFreeResponseQuestion(
    slideContent: string
  ): Promise<FreeResponseQuestion> {
    try {
      const prompt = this.createFreeResponsePrompt(slideContent);

      const completion = await this.openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that creates educational free response questions about blockchain technology. Always return valid JSON format."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0].message.content || '';
      return this.parseFreeResponseQuestion(content);
    } catch (error) {
      console.error('Error generating free response question:', error);
      throw error;
    }
  }

  /**
   * Grade a free response answer
   */
  public async gradeFreeResponseAnswer(
    question: string,
    rubric: string,
    userAnswer: string
  ): Promise<{ score: number; feedback: string }> {
    try {
      const prompt = this.createGradingPrompt(question, rubric, userAnswer);

      const completion = await this.openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a fair and consistent grader for blockchain education questions. Always return valid JSON format."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent grading
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0].message.content || '';
      return this.parseGradingResult(content);
    } catch (error) {
      console.error('Error grading free response answer:', error);
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

  private createFreeResponsePrompt(slideContent: string): string {
    return `Based on the following course material, generate a thoughtful free response question that tests understanding of key concepts:
            
            ${slideContent}
            
            Format the response as a JSON object with:
            - "question": string (The free response question)
            - "sampleAnswer": string (An example of what a good answer would include)
            - "rubric": string (Criteria for grading answers, including key points that should be mentioned)
            
            Example:
            {
              "question": "Explain how proof of work and proof of stake differ in their approach to consensus, and discuss the environmental implications of each.",
              "sampleAnswer": "Proof of Work (PoW) and Proof of Stake (PoS) are consensus mechanisms used in blockchain systems...",
              "rubric": "A good answer should: 1) Correctly explain the basic mechanism of PoW (computational puzzles, mining) 2) Correctly explain the basic mechanism of PoS (validator selection based on stake) 3) Compare the energy consumption of both approaches 4) Discuss at least one environmental advantage of PoS over PoW"
            }`;
  }

  private createGradingPrompt(
    question: string,
    rubric: string,
    userAnswer: string
  ): string {
    return `Please grade the following free response answer based on the provided rubric.
    
    Question: ${question}
    
    Rubric: ${rubric}
    
    Student Answer: ${userAnswer}
    
    Grade the answer on a scale of 0-100 based on how well it meets the criteria in the rubric.
    Provide specific feedback explaining the score and suggesting improvements.
    
    Format your response as a JSON object with:
    - "score": number (between 0 and 100)
    - "feedback": string (specific feedback on the answer)
    
    Example:
    {
      "score": 85,
      "feedback": "Your answer correctly explains the basic mechanisms of both PoW and PoS, and effectively compares their energy usage. To improve, you could have elaborated more on the specific environmental advantages of PoS beyond just energy efficiency."
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

  private parseFreeResponseQuestion(content: string): FreeResponseQuestion {
    try {
      const parsed = JSON.parse(content);
      
      if (!parsed.question || typeof parsed.question !== 'string') {
        throw new Error('Invalid free response question: missing or invalid question text');
      }
      if (!parsed.sampleAnswer || typeof parsed.sampleAnswer !== 'string') {
        throw new Error('Invalid free response question: missing or invalid sample answer');
      }
      if (!parsed.rubric || typeof parsed.rubric !== 'string') {
        throw new Error('Invalid free response question: missing or invalid rubric');
      }
      
      return {
        question: parsed.question,
        sampleAnswer: parsed.sampleAnswer,
        rubric: parsed.rubric
      };
    } catch (error) {
      console.error('Error parsing free response question:', error);
      throw new Error('Failed to parse free response question from AI response');
    }
  }

  private parseGradingResult(content: string): { score: number; feedback: string } {
    try {
      const parsed = JSON.parse(content);
      
      if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 100) {
        throw new Error('Invalid grading result: score must be a number between 0 and 100');
      }
      if (!parsed.feedback || typeof parsed.feedback !== 'string') {
        throw new Error('Invalid grading result: missing or invalid feedback');
      }
      
      return {
        score: parsed.score,
        feedback: parsed.feedback
      };
    } catch (error) {
      console.error('Error parsing grading result:', error);
      throw new Error('Failed to parse grading result from AI response');
    }
  }
}