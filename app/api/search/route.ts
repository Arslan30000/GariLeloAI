import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import type { SearchFilters } from '../../types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Strip markdown code-fences that Gemini sometimes wraps around JSON.
 * e.g.  ```json\n{...}\n```  ->  {...}
 */
function sanitizeGeminiJson(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userQuery: string = body?.userQuery ?? '';

    if (!userQuery.trim()) {
      return NextResponse.json(
        { error: 'userQuery is required' },
        { status: 400 }
      );
    }

    // 1. Gemini: translate natural language -> structured JSON filters
    // Using gemini-2.5-flash — 1 call per search so daily quota is not a concern.
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const prompt = `
      You are an expert car search assistant for the Pakistani used-car market.
      Extract structured search filters from this query: "${userQuery}"

      Return ONLY a valid JSON object with exactly these keys (null if not mentioned):
      {
        "make": string | null,
        "model": string | null,
        "max_price": number | null,
        "city": string | null,
        "transmission": string | null,
        "color": string | null
      }

      Rules:
      - Output ONLY the JSON -- no markdown, no explanation.
      - Normalise make/model to proper case (e.g. "honda" -> "Honda").
      - max_price in PKR: "40 lacs" -> 4000000, "1 crore" -> 10000000.
      - If the user says "auto" treat transmission as "Automatic".
      - If the user says "Pindi" treat city as "Rawalpindi".
    `;

    let filters: SearchFilters;
    try {
      const aiResult = await model.generateContent(prompt);
      const rawText = aiResult.response.text();
      const sanitized = sanitizeGeminiJson(rawText);
      filters = JSON.parse(sanitized) as SearchFilters;
    } catch (geminiError) {
      console.error('Gemini error:', geminiError);
      // Fallback: return all cars with no filters rather than failing
      filters = {
        make: null,
        model: null,
        max_price: null,
        city: null,
        transmission: null,
        color: null,
      };
    }

    // 2. Supabase: dynamic query built from non-null filters
    let dbQuery = supabase.from('cars').select('*');

    if (filters.make)              dbQuery = dbQuery.ilike('make', `%${filters.make}%`);
    if (filters.model)             dbQuery = dbQuery.ilike('model', `%${filters.model}%`);
    if (filters.max_price != null) dbQuery = dbQuery.lte('price', filters.max_price);
    if (filters.city)              dbQuery = dbQuery.ilike('city', `%${filters.city}%`);
    if (filters.transmission)      dbQuery = dbQuery.ilike('transmission', `%${filters.transmission}%`);
    if (filters.color)             dbQuery = dbQuery.ilike('color', `%${filters.color}%`);

    // Sort: best AI-scored deals first, then by price. Exclude unevaluated cars.
    const { data: cars, error: dbError } = await dbQuery
      .not('ai_label', 'eq', 'Unevaluated')
      .not('ai_score', 'is', null)
      .order('ai_score', { ascending: false, nullsFirst: false })
      .order('price', { ascending: true })
      .limit(24);

    if (dbError) {
      console.error('Supabase query error:', dbError);
      return NextResponse.json(
        { error: 'Database query failed.', details: dbError.message },
        { status: 500 }
      );
    }

    // 3. Return results + interpreted filters for AI feedback UI
    return NextResponse.json({
      interpretedFilters: filters,
      results: cars ?? [],
    });

  } catch (error) {
    console.error('Search API unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to process search. Please try again.' },
      { status: 500 }
    );
  }
}