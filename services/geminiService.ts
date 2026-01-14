import { GoogleGenAI } from "@google/genai";
import { User, Transaction } from "../types";

// NOTE: In Phase 4 (Production), this file should be replaced by a call to your backend/Supabase Edge Function.
// Storing the API Key in the frontend is safe for prototypes but unsafe for production apps.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getFinancialAdvice = async (
  userQuery: string,
  userContext: User,
  transactions: Transaction[]
): Promise<string> => {
  try {
    const modelId = "gemini-3-flash-preview";
    
    // Construct a context-aware system instruction
    const systemInstruction = `
      You are Spend.AI, a highly intelligent and professional financial assistant.
      
      User Context:
      - Name: ${userContext.name}
      - Current Balance: ₦${userContext.walletBalance.toLocaleString()}
      - Account Status: ${userContext.kycVerified ? "Verified" : "Unverified"}
      
      Recent Transactions:
      ${JSON.stringify(transactions.slice(0, 10))}

      Features Available:
      - **Secure Link**: The user can generate a passcode-protected payment link from their dashboard to send money to anyone (even without an account). It's great for pocket money or paying casual workers.

      Your Goal:
      - Provide concise, helpful financial advice based on the user's data.
      - If the user asks about sending money safely or to someone without an account, recommend the "Secure Link" feature.
      - If the user asks about affordability, analyze their balance and recent spending habits.
      - Keep the tone professional but approachable (fintech startup vibe).
      - Currency is Naira (₦).
      - Do not hallucinate transactions that are not in the list.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: userQuery,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "I'm having trouble analyzing your finances right now. Please try again.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I am currently offline. Please check your connection.";
  }
};