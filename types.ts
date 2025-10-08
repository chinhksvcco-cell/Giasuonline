export enum Sender {
  User = 'user',
  AI = 'ai',
}

export interface FileAttachment {
  name: string;
  mimeType: string;
  data: string; // base64 data URL
}

export interface Message {
  id?: number;
  sender: Sender;
  text: string;
  file?: FileAttachment;
  suggestions?: string[];
  imageIsLoading?: boolean;
}

export interface ChatSession {
  id: number;
  grade: string;
  subject: string;
  messages: Message[];
  timestamp: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface LessonSummary {
  topic: string;
  timestamp: string;
}

export interface LearningProgress {
  [subjectKey: string]: LessonSummary[];
}
