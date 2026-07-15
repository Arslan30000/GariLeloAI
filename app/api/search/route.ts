import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Strip markdown code-fences that Gemini sometimes wraps around JSON.
 * e.g.  ```json\n{...}\n```  →  {...}
 */
function sanitizeGeminiJson(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

interface SearchFilters {
  make: string | null;
  model: string | null;
  max_price: number | null;
  city: string | null;
  transmission: 'Automatic' | 'Manual' | null;
  color: string | null;
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

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const prompt = `
      You are an expert car search assistant for the Pakistani market.
      Extract the specific search filters from this user query: "${userQuery}"

      Return ONLY a valid JSON object with these exact keys (use null if the user doesn't mention it):
      {
        "make": "string or null (e.g., Honda, Toyota, Suzuki)",
        "model": "string or null (e.g., Civic, Corolla, Cultus)",
        "max_price": "number or null in PKR (e.g., convert '40 lacs' to 4000000)",
        "city": "string or null (e.g., Rawalpindi, Islamabad)",
        "transmission": "string or null (strictly 'Automatic' or 'Manual')",
        "color": "string or null (e.g., White, Black)"
      }

      Do NOT include any explanatory text — output only the JSON object.
    `;

    let filters: SearchFilters;
    try {
      const aiResult = await model.generateContent(prompt);
      const rawText = aiResult.response.text();
      const sanitized = sanitizeGeminiJson(rawText);
      filters = JSON.parse(sanitized) as SearchFilters;
    } catch (geminiError) {
      console.error('Gemini parse error:', geminiError);
      return NextResponse.json(
        { error: 'AI failed to parse the query. Please try rephrasing.' },
        { status: 422 }
      );
    }

    let dbQuery = supabase.from('cars').select('*');

    if (filters.make)         dbQuery = dbQuery.ilike('make', `%${filters.make}%`);
    if (filters.model)        dbQuery = dbQuery.ilike('model', `%${filters.model}%`);
    if (filters.max_price != null) dbQuery = dbQuery.lte('price', filters.max_price);
    if (filters.city)         dbQuery = dbQuery.ilike('city', `%${filters.city}%`);
    if (filters.transmission) dbQuery = dbQuery.ilike('transmission', `%${filters.transmission}%`);
    if (filters.color)        dbQuery = dbQuery.ilike('color', `%${filters.color}%`);

    const { data: cars, error: dbError } = await dbQuery
      .order('price', { ascending: true })
      .limit(20);

    if (dbError) {
      console.error('Supabase query error:', dbError);
      return NextResponse.json(
        { error: 'Database query failed.', details: dbError.message },
        { status: 500 }
      );
    }

    // ── 3. Return results ──────────────────────────────────────────
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