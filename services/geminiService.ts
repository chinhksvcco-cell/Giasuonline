
import { GoogleGenAI, Type, Part, Content } from "@google/genai";
import { getSystemInstruction, getQuizGenerationSystemInstruction, getSummarizationSystemInstruction } from '../constants';
import type { QuizQuestion, Message, FileAttachment } from '../types';
import { Sender } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export interface TutorResponse {
    text: string;
    suggestions: string[];
    imagePrompt?: string;
}

const getBase64Data = (dataUrl: string): string => {
    const parts = dataUrl.split(',');
    if (parts.length === 2) {
        return parts[1];
    }
    // Return original string if it's not a valid data URL
    return dataUrl; 
};


export const getTutorResponse = async (
    history: Message[],
    grade: string, 
    subject: string, 
    completedLessons?: string,
    isResuming?: boolean
): Promise<TutorResponse> => {
    try {
        const finalContents: Content[] = history.map((msg): Content => {
            const parts: Part[] = [];

            if (msg.file) {
                 parts.push({
                    inlineData: {
                        mimeType: msg.file.mimeType,
                        data: getBase64Data(msg.file.data),
                    }
                });
            }
            
            // Add text part if it exists.
            if(msg.text) {
                parts.push({ text: msg.text });
            }

            // The user role must have at least one part.
            if (msg.sender === Sender.User && parts.length === 0) {
                parts.push({ text: "Please analyze the attached file." });
            }

            return {
                role: msg.sender === Sender.User ? 'user' : 'model',
                parts: parts,
            };
        });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: finalContents,
            config: {
                systemInstruction: getSystemInstruction(grade, subject, completedLessons, isResuming),
                temperature: 0.7,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        response: { type: Type.STRING },
                        suggestions: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        imagePrompt: { type: Type.STRING }
                    },
                    required: ["response", "suggestions"]
                }
            },
        });

        const jsonText = response.text.trim();
        const parsedResponse = JSON.parse(jsonText);

        if (parsedResponse && typeof parsedResponse.response === 'string' && Array.isArray(parsedResponse.suggestions)) {
            return {
                text: parsedResponse.response,
                suggestions: parsedResponse.suggestions,
                imagePrompt: parsedResponse.imagePrompt,
            };
        } else {
             throw new Error("Invalid JSON response structure from AI.");
        }

    } catch (error) {
        console.error("Error processing Gemini API response:", error);
        return {
            text: `Rất tiếc, đã có lỗi xảy ra. Em vui lòng thử lại sau nhé.`,
            suggestions: ["Thử hỏi lại câu vừa rồi", "Bắt đầu lại buổi học"]
        };
    }
};

export const summarizeChatSession = async (
    messages: Message[],
    grade: string,
    subject: string
): Promise<string> => {
    try {
        const conversation = messages.map(m => `${m.sender === 'user' ? 'Học sinh' : 'Cô giáo'}: ${m.text}`).join('\n');
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: conversation,
            config: {
                systemInstruction: getSummarizationSystemInstruction(grade, subject),
                temperature: 0.2,
            },
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error summarizing chat session:", error);
        return ""; 
    }
};

export const getQuizQuestions = async (
    grade: string,
    subject: string,
    topic: string,
    count: number = 5
): Promise<QuizQuestion[]> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Tạo ${count} câu hỏi trắc nghiệm.`,
            config: {
                systemInstruction: getQuizGenerationSystemInstruction(grade, subject, topic),
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            options: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            },
                            correctAnswer: { type: Type.STRING },
                            explanation: { type: Type.STRING }
                        },
                        required: ["question", "options", "correctAnswer", "explanation"]
                    }
                }
            }
        });
        
        const jsonText = response.text.trim();
        const questions = JSON.parse(jsonText);

        // Validate the structure
        if (!Array.isArray(questions) || questions.some(q => !q.question || !q.options || !q.correctAnswer || !q.explanation)) {
             throw new Error("Định dạng dữ liệu câu hỏi không hợp lệ.");
        }
        
        return questions;

    } catch (error) {
        console.error("Error generating quiz questions:", error);
        if (error instanceof Error) {
            throw new Error(`Không thể tạo câu hỏi: ${error.message}`);
        }
        throw new Error("Đã có lỗi không xác định khi tạo câu hỏi trắc nghiệm.");
    }
}


export const getWrittenAnswerFeedback = async (
    file: FileAttachment,
    question: QuizQuestion
): Promise<string> => {
    try {
        const systemInstruction = `Bạn là một cô giáo AI thân thiện, đang chấm bài cho học sinh.
Nhiệm vụ của bạn là xem xét hình ảnh hoặc file PDF bài làm viết tay của học sinh và đưa ra nhận xét.

Bối cảnh:
- Câu hỏi trắc nghiệm: "${question.question}"
- Đáp án đúng: "${question.correctAnswer}"
- Giải thích chi tiết: "${question.explanation}"

Yêu cầu:
1. Phân tích kỹ lưỡng bài làm của học sinh trong file đính kèm.
2. So sánh bài làm đó với đáp án đúng và lời giải thích đã cho.
3. Đưa ra nhận xét mang tính xây dựng, nhẹ nhàng và khích lệ. Bắt đầu bằng việc khen ngợi nỗ lực của em ("Cô thấy em đã rất cố gắng...").
4. Chỉ ra những điểm học sinh đã làm đúng.
5. Nếu có lỗi sai, hãy chỉ ra cụ thể và giải thích tại sao nó sai, dựa trên lời giải thích đã cung cấp. Đừng chỉ nói "sai rồi", hãy hướng dẫn em cách làm đúng.
6. Giọng văn: Thân thiện, gần gũi, xưng "cô" và gọi học sinh là "em". Sử dụng emoji phù hợp (ví dụ: 👍, 🤔, 💡, 😊).
7. Kết thúc bằng một lời động viên.
8. Chỉ trả về phần văn bản nhận xét, không thêm bất kỳ định dạng nào khác.`;

        const filePart: Part = {
            inlineData: {
                mimeType: file.mimeType,
                data: getBase64Data(file.data),
            }
        };
        
        const textPart: Part = {
            text: "Đây là bài làm của em, cô xem giúp em với ạ."
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [filePart, textPart] }],
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.5,
            },
        });

        return response.text.trim();

    } catch (error) {
        console.error("Error getting written answer feedback:", error);
        return "Rất tiếc, đã có lỗi xảy ra khi cô phân tích bài làm của em. Em thử lại sau nhé.";
    }
};

export const translateToEnglish = async (text: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Translate the following Vietnamese text to English, and only return the translated text without any preamble: "${text}"`,
        });
        return response.text;
    } catch (error) {
        console.error("Error translating text with Gemini API:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to translate: ${error.message}`);
        }
        throw new Error("An unknown error occurred during translation.");
    }
};

export const generateAvatarImage = async (prompt: string): Promise<string> => {
    try {
        const fullPrompt = `An avatar for a friendly female AI tutor for Vietnamese students. Style: cute, simple, cartoon, vector art. Subject: ${prompt}.`;
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: fullPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '1:1',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/png;base64,${base64ImageBytes}`;
        } else {
            throw new Error("The API did not return any images.");
        }
    } catch (error) {
        console.error("Error generating avatar image:", error);
        if (error instanceof Error) {
            throw new Error(`Không thể tạo avatar: ${error.message}`);
        }
        throw new Error("Đã có lỗi không xác định khi tạo avatar.");
    }
};

export const generateIllustration = async (prompt: string): Promise<string> => {
    try {
        const englishPrompt = await translateToEnglish(prompt);
        const fullPrompt = `Educational illustration for a student. Style: clear, simple, colorful, diagrammatic. Subject: ${englishPrompt}. IMPORTANT: Any text or labels in the image must be written bilingually in both English and Vietnamese. For example: "Sun (Mặt trời)". Original Vietnamese context: "${prompt}".`;
        
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: fullPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '16:9',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/png;base64,${base64ImageBytes}`;
        } else {
            throw new Error("API không trả về hình ảnh nào.");
        }
    } catch (error) {
        console.error("Lỗi khi tạo hình minh họa:", error);
        if (error instanceof Error) {
            throw new Error(`Không thể tạo hình ảnh: ${error.message}`);
        }
        throw new Error("Đã có lỗi không xác định khi tạo hình ảnh minh họa.");
    }
};
