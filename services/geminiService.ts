import { GoogleGenAI, Type } from "@google/genai";
import { Expense, Category, PaymentMethod } from '../types';
import { PAYMENT_METHODS } from "../constants";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    console.warn("API_KEY environment variable not set. Smart suggestions will not be available.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

export const getSavingTips = async (expenses: Expense[]): Promise<string> => {
    if (!API_KEY) {
        return "Smart suggestions are currently unavailable. Please configure your Gemini API key.";
    }

    if (expenses.length === 0) {
        return "No expenses recorded yet. Add some expenses to get personalized savings tips!";
    }
    
    const formattedExpenses = expenses.map(e => `- ${e.date}: ₹${e.amount} on ${e.category} (${e.description}) via ${e.paymentMethod}`).join('\n');

    const prompt = `
        You are a friendly and encouraging financial advisor for a user in India. 
        Your goal is to provide actionable savings tips based on their recent expenses.
        The currency is Indian Rupees (₹).

        Analyze the following list of expenses:
        ${formattedExpenses}

        Based on this data, provide 3-5 concise, actionable, and personalized savings tips. 
        Frame your suggestions positively. For example, instead of "You spend too much on food", say "You could save a significant amount by exploring home-cooked meals.".
        If possible, estimate potential monthly savings for a suggestion.
        Start your response with a brief, encouraging summary.
        Format the tips as a bulleted list.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        console.error("Error fetching saving tips from Gemini API:", error);
        return "Sorry, I couldn't generate savings tips at the moment. Please try again later.";
    }
};

export const extractExpenseFromImage = async (
    imageData: { mimeType: string, data: string },
    categories: Category[]
): Promise<Partial<Omit<Expense, 'id'>>> => {
     if (!API_KEY) {
        throw new Error("API_KEY environment variable not set. Smart features are not available.");
    }

    const imagePart = {
        inlineData: imageData,
    };

    const textPart = {
        text: `Analyze the attached image (which could be a bill, receipt, or screenshot of a transaction message) and extract the expense details. Identify the total amount, the date of the transaction, a brief description, the payment method used (${PAYMENT_METHODS.join(', ')}), and categorize it into one of the following categories: ${categories.join(', ')}. If the date is not present, use today's date. If the payment method is not clear, default to 'UPI'. The currency is INR.`,
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        date: {
                            type: Type.STRING,
                            description: "The transaction date in YYYY-MM-DD format. If not found, use the current date.",
                        },
                        category: {
                            type: Type.STRING,
                            description: `The expense category. Must be one of: ${categories.join(', ')}.`,
                            enum: categories,
                        },
                        amount: {
                            type: Type.NUMBER,
                            description: "The total expense amount as a number.",
                        },
                        description: {
                            type: Type.STRING,
                            description: "A brief description of the expense (e.g., merchant name, items purchased).",
                        },
                        paymentMethod: {
                            type: Type.STRING,
                            description: `The payment method used. Must be one of: ${PAYMENT_METHODS.join(', ')}.`,
                            enum: PAYMENT_METHODS,
                        }
                    },
                    required: ["amount", "description", "category", "date", "paymentMethod"],
                },
            },
        });
        
        const jsonText = response.text.trim();
        const extractedData = JSON.parse(jsonText);
        
        // Validate category
        if (!categories.includes(extractedData.category)) {
            extractedData.category = 'Other';
        }
        
        // Validate payment method
        if (!PAYMENT_METHODS.includes(extractedData.paymentMethod)) {
            extractedData.paymentMethod = 'UPI';
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(extractedData.date)) {
            extractedData.date = new Date().toISOString().split('T')[0];
        }

        return {
            date: extractedData.date,
            category: extractedData.category as Category,
            amount: extractedData.amount,
            description: extractedData.description,
            paymentMethod: extractedData.paymentMethod as PaymentMethod
        };

    } catch (error) {
        console.error("Error extracting expense from image:", error);
        throw new Error("Could not analyze the image. Please try again or enter the details manually.");
    }
};