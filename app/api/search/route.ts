import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';
import type { SearchFilters } from '../../types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userQuery: string = body?.userQuery ?? '';

    if (!userQuery.trim()) {
      return NextResponse.json({ error: 'userQuery is required' }, { status: 400 });
    }

    // ── 1. Groq (Llama 3): translate natural language → structured JSON filters ─
    const prompt = `
You are an expert car search assistant for the Pakistani used-car market.
Extract structured search filters from this query: "${userQuery}"

Return ONLY a valid JSON object with exactly these keys (null if not mentioned):
{
  "make": string | null,
  "model": string | null,
  "min_price": number | null,
  "max_price": number | null,
  "min_year": number | null,
  "max_year": number | null,
  "city": string | null,
  "transmission": string | null,
  "color": string | null,
  "body_type": string | null,
  "fuel_type": string | null,
  "engine_capacity": number | null,
  "ai_score_min": number | null,
  "keyword_search": string | null,
  "include_call_for_price": boolean | null
}

Field rules:
- make/model: proper case (e.g. "honda" → "Honda", "civic" → "Civic")
- prices in PKR: "40 lacs" → 4000000, "1 crore" → 10000000
- transmission: ONLY "Automatic" or "Manual" — null otherwise
- body_type: map vehicle category words → EXACTLY one of: "Van", "SUV", "Sedan", "Hatchback", "Pickup", "Crossover", "Wagon", "Minivan", "MPV", "Coupe"
  Examples: "van" → "Van", "family car" → "Minivan" or "SUV"
- fuel_type: map to EXACTLY one of: "Petrol", "Diesel", "Hybrid", "Electric", "CNG"
- city: "Pindi" → "Rawalpindi", "Isb" → "Islamabad", "Khi" → "Karachi", "Lhr" → "Lahore"
- engine_capacity: if user wants "fast cars", set this to 1800 or 2000.
- keyword_search: if the query has semantic terms like "fast", "luxury", "reliable", "family", output that keyword here.
- include_call_for_price: if the user explicitly asks for "luxury cars" or doesn't mention a price, set to true. If they set a max_price (e.g., "under 30 lac"), set this to STRICTLY false so we don't show price=0 cars.

Pakistani van/minivan brands to know: Suzuki Bolan, Toyota HiAce, Nissan Vanette, Daihatsu Hijet
When user says "van" set body_type to "Van" and leave make/model null unless specified.

Output ONLY the JSON object. Do not include markdown formatting or explanations.
`;

    let filters: SearchFilters;
    let geminiOk = true; // Kept variable name for frontend compatibility
    try {
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a car search assistant. You output strict JSON objects.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const rawText = response.choices[0]?.message?.content?.trim() || '{}';
      filters = JSON.parse(rawText) as SearchFilters;
    } catch (apiError) {
      console.error('Groq API error in search route:', apiError);
      geminiOk = false;
      // Basic fallback
      const words = userQuery.trim().split(/\s+/);
      filters = {
        make: words[0] ? words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase() : null,
        model: words[1] ? words[1].charAt(0).toUpperCase() + words[1].slice(1).toLowerCase() : null,
        min_price: null,
        max_price: null,
        min_year: null,
        max_year: null,
        city: null,
        transmission: null,
        color: null,
        body_type: null,
        fuel_type: null,
        engine_capacity: null,
        ai_score_min: null,
        keyword_search: null,
        include_call_for_price: null,
      };
    }

    // ── Merge manual JSON overrides from body if they exist ──────────────
    if (body?.manualFilters) {
      filters = { ...filters, ...body.manualFilters };
    }

    // ── 2. Supabase: dynamic query built from non-null filters ──────────
    const applyFilters = (q: any) => {
      if (filters.make)              q = q.ilike('make', `%${filters.make}%`);
      if (filters.model)             q = q.ilike('model', `%${filters.model}%`);
      
      if (filters.max_price != null) {
        q = q.lte('price', filters.max_price);
        if (filters.include_call_for_price === false) {
          q = q.gt('price', 0);
        }
      }
      if (filters.min_price != null) {
        q = q.gte('price', filters.min_price);
      }
      
      if (filters.min_year != null)  q = q.gte('year', filters.min_year);
      if (filters.max_year != null)  q = q.lte('year', filters.max_year);
      
      if (filters.city)              q = q.ilike('city', `%${filters.city}%`);
      if (filters.transmission)      q = q.ilike('transmission', `%${filters.transmission}%`);
      if (filters.color)             q = q.ilike('color', `%${filters.color}%`);
      if (filters.body_type)         q = q.ilike('body_type', `%${filters.body_type}%`);
      if (filters.fuel_type)         q = q.ilike('fuel_type', `%${filters.fuel_type}%`);
      
      if (filters.engine_capacity != null) q = q.gte('engine_capacity', filters.engine_capacity);
      if (filters.ai_score_min != null)    q = q.gte('ai_score', filters.ai_score_min);
      
      if (filters.keyword_search) {
        // Search the keyword in either the seller description or the AI summary
        q = q.or(`seller_description.ilike.%${filters.keyword_search}%,ai_summary.ilike.%${filters.keyword_search}%`);
      }
      
      return q;
    };

    // Sort: best AI-scored deals first, then cheapest. Show unevaluated only if no rated results.
    const { data: ratedCars, error: dbError } = await applyFilters(supabase.from('cars').select('*'))
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

    // If no rated cars found, widen to include unevaluated as fallback
    let cars = ratedCars ?? [];
    if (cars.length === 0) {
      const { data: allCars } = await applyFilters(supabase.from('cars').select('*'))
        .order('price', { ascending: true })
        .limit(24);
      cars = allCars ?? [];
    }


    return NextResponse.json({
      interpretedFilters: filters,
      geminiOk,
      results: cars,
    });

  } catch (error) {
    console.error('Search API unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to process search. Please try again.' },
      { status: 500 }
    );
  }
}