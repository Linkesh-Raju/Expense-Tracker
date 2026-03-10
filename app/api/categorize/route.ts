import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { title } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // For serverless environments where NEXT_PUBLIC_ is not used for secret keys,
    // make sure GEMINI_API_KEY is defined in your environment variables (.env.local).
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is not set. Falling back to General category.");
      return NextResponse.json({ category: "General" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a financial categorization assistant. Categorize the following transaction title into exactly ONE of these categories: Food, Transport, Utilities, Entertainment, Shopping, Health, Salary, Rent, or General. Respond with ONLY the category word and nothing else.
Title: ${title}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    // Validate output to ensure it matches one of our expected categories
    const validCategories = ["Food", "Transport", "Utilities", "Entertainment", "Shopping", "Health", "Salary", "Rent", "General"];
    
    // Find matching category (case-insensitive) or default to General
    const matchedCategory = validCategories.find(c => c.toLowerCase() === responseText.toLowerCase()) || "General";

    return NextResponse.json({ category: matchedCategory });

  } catch (error) {
    console.error("Error in AI categorization:", error);
    // Graceful fallback on error
    return NextResponse.json({ category: "General" });
  }
}
