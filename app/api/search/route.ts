import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import type { SearchFilters } from '../../types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

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
    const prompt = `
      You are an expert car search assistant for the Pakistani used-car market.
      Extract structured search filters from this query: "${userQuery}"

      Return ONLY a valid JSON object with exactly these keys (null if not mentioned):
      {
        "make": string | null,         // e.g. "Honda", "Toyota", "Suzuki", "Kia"
        "model": string | null,        // e.g. "Civic", "Corolla", "Cultus", "Sportage"
        "max_price": number | null,    // in PKR -- convert "40 lacs" -> 4000000, "1 crore" -> 10000000
        "city": string | null,         // e.g. "Rawalpindi", "Islamabad", "Lahore", "Karachi"
        "transmission": string | null, // STRICTLY "Automatic" or "Manual" only
        "color": string | null         // e.g. "White", "Black", "Silver", "Red"
      }

      Rules:
      - Output ONLY the JSON -- no markdown, no explanation.
      - Normalise make/model to proper case (e.g. "honda" -> "Honda").
      - If the user says "auto" treat it as "Automatic".
      - If the user says "Pindi" or "pindi" treat city as "Rawalpindi".
    `;

    let filters: SearchFilters;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      const rawText = response.text ?? '';
      const sanitized = sanitizeGeminiJson(rawText);
      filters = JSON.parse(sanitized) as SearchFilters;
    } catch (geminiError) {
      console.error('Gemini parse error:', geminiError);
      return NextResponse.json(
        { error: 'AI failed to parse the query. Please try rephrasing.' },
        { status: 422 }
      );
    }

    // 2. Supabase: dynamic query built from non-null filters
    let dbQuery = supabase.from('cars').select('*');

    if (filters.make)              dbQuery = dbQuery.ilike('make', `%${filters.make}%`);
    if (filters.model)             dbQuery = dbQuery.ilike('model', `%${filters.model}%`);
    if (filters.max_price != null) dbQuery = dbQuery.lte('price', filters.max_price);
    if (filters.city)              dbQuery = dbQuery.ilike('city', `%${filters.city}%`);
    if (filters.transmission)      dbQuery = dbQuery.ilike('transmission', `%${filters.transmission}%`);
    if (filters.color)             dbQuery = dbQuery.ilike('color', `%${filters.color}%`);

    // Sort: best AI-scored deals first, then cheapest. Exclude unevaluated.
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