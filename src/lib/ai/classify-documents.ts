import Anthropic from '@anthropic-ai/sdk';

const DD_CATEGORIES = [
  { id: 'financials', name: 'Financials', icon: '📊', keywords: ['p&l', 'profit', 'loss', 'financial', 'bank statement', 'operating statement', 'rent roll', 'pro forma', 'proforma', 'budget', 'income', 'expense', 'utility', 'tax return', 'balance sheet'] },
  { id: 'legal', name: 'Legal', icon: '⚖️', keywords: ['title', 'survey', 'alta', 'zoning', 'estoppel', 'hoa', 'association', 'lien', 'deed', 'easement', 'covenant'] },
  { id: 'environmental', name: 'Environmental', icon: '🌿', keywords: ['environmental', 'phase i', 'phase ii', 'esa', 'asbestos', 'lead', 'ust', 'ast', 'remediation', 'contamination'] },
  { id: 'property_condition', name: 'Property Condition', icon: '🏗️', keywords: ['property condition', 'pcr', 'capital needs', 'roof', 'hvac', 'mechanical', 'structural', 'inspection', 'ada', 'construction', 'floor plan'] },
  { id: 'fire_safety', name: 'Fire & Life Safety', icon: '🔥', keywords: ['fire', 'nfpa', 'sprinkler', 'alarm', 'backflow', 'life safety', 'extinguisher'] },
  { id: 'insurance', name: 'Insurance', icon: '🛡️', keywords: ['insurance', 'bop', 'umbrella', 'policy', 'coverage', 'endorsement', 'certificate of insurance', 'coi'] },
  { id: 'leases', name: 'Lease Agreements', icon: '📋', keywords: ['lease', 'rental', 'tenant', 'occupancy', 'renewal', 'amendment', 'rent payment', 'tenant correspondence'] },
  { id: 'elevator_operations', name: 'Elevator & Operations', icon: '🔧', keywords: ['elevator', 'certificate of operation', 'maintenance contract', 'annual report', 'operations'] },
  { id: 'photos_plans', name: 'Photos & Plans', icon: '📷', keywords: ['photo', 'picture', 'image', 'floor plan', 'site plan', 'aerial', 'drone'] },
  { id: 'marketing', name: 'Marketing & OM', icon: '📢', keywords: ['offering memorandum', 'om', 'marketing', 'brochure', 'presentation', 'pitch'] },
  { id: 'other', name: 'Other Documents', icon: '📁', keywords: [] },
];

export interface ClassifiedFile {
  originalPath: string;
  fileName: string;
  category: string;
  categoryName: string;
  categoryIcon: string;
  confidence: 'high' | 'medium' | 'low';
}

export async function classifyDocuments(filePaths: string[]): Promise<ClassifiedFile[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: use keyword matching if no API key
    return filePaths.map((p) => classifyByKeywords(p));
  }

  const anthropic = new Anthropic({ apiKey });

  const categoryList = DD_CATEGORIES.map((c) => `- ${c.id}: ${c.name}`).join('\n');

  const fileList = filePaths.map((p, i) => `${i + 1}. ${p}`).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a commercial real estate due diligence document classifier. Classify each file into exactly one category based on its filename and folder path.

Categories:
${categoryList}

Files to classify:
${fileList}

Respond with ONLY a JSON array. Each element: {"index": <number>, "category": "<category_id>", "confidence": "high"|"medium"|"low"}

Example: [{"index": 1, "category": "financials", "confidence": "high"}, {"index": 2, "category": "legal", "confidence": "medium"}]

JSON only, no other text:`,
      },
    ],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return filePaths.map((p) => classifyByKeywords(p));
    }

    const classifications: { index: number; category: string; confidence: string }[] = JSON.parse(jsonMatch[0]);

    return filePaths.map((path, i) => {
      const match = classifications.find((c) => c.index === i + 1);
      const catId = match?.category ?? 'other';
      const cat = DD_CATEGORIES.find((c) => c.id === catId) ?? DD_CATEGORIES[DD_CATEGORIES.length - 1];

      return {
        originalPath: path,
        fileName: path.split('/').pop() ?? path,
        category: cat.id,
        categoryName: cat.name,
        categoryIcon: cat.icon,
        confidence: (match?.confidence as 'high' | 'medium' | 'low') ?? 'low',
      };
    });
  } catch {
    // Fallback to keyword matching
    return filePaths.map((p) => classifyByKeywords(p));
  }
}

function classifyByKeywords(filePath: string): ClassifiedFile {
  const lower = filePath.toLowerCase();
  const fileName = filePath.split('/').pop() ?? filePath;

  for (const cat of DD_CATEGORIES) {
    if (cat.id === 'other') continue;
    if (cat.keywords.some((kw) => lower.includes(kw))) {
      return {
        originalPath: filePath,
        fileName,
        category: cat.id,
        categoryName: cat.name,
        categoryIcon: cat.icon,
        confidence: 'medium',
      };
    }
  }

  return {
    originalPath: filePath,
    fileName,
    category: 'other',
    categoryName: 'Other Documents',
    categoryIcon: '📁',
    confidence: 'low',
  };
}

export { DD_CATEGORIES };
