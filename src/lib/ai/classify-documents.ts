import Anthropic from '@anthropic-ai/sdk';

// These match our exact 12 DD folder structure
const DD_CATEGORIES = [
  { id: 'marketing', name: 'Marketing', icon: '📢',
    keywords: ['offering memorandum', 'om', 'marketing', 'brochure', 'listing', 'website', 'professional photo'] },
  { id: 'market_research', name: 'Market Research', icon: '📊',
    keywords: ['costar', 'crexi', 'demographics', 'market report', 'comp', 'comparable', 'traffic count', 'submarket'] },
  { id: 'legal', name: 'Legal', icon: '⚖️',
    keywords: ['title', 'survey', 'alta', 'zoning', 'estoppel', 'hoa', 'lien', 'deed', 'easement', 'loi', 'psa', 'purchase agreement', 'entity', 'operating agreement', 'contract', 'service agreement', 'vendor', 'property management', 'certificate of occupancy', 'litigation', 'violation', 'code enforcement', 'employee', 'staff'] },
  { id: 'financials', name: 'Financials', icon: '💰',
    keywords: ['p&l', 'profit', 'loss', 'financial', 'bank statement', 'operating statement', 'rent roll', 'pro forma', 'proforma', 'budget', 'income', 'expense', 'utility', 'tax bill', 'tax return', 'balance sheet', 't-12', 't-3', 'accounts receivable', 'aging', 'bad debt', 'security deposit', 'capital expenditure', 'capex'] },
  { id: 'leases', name: 'Leases', icon: '📋',
    keywords: ['lease', 'rental agreement', 'tenant', 'eviction', 'delinquency', 'move-in', 'move-out', 'concession', 'lease expiration', 'lease abstract', 'snda', 'cam reconciliation', 'percentage rent', 'co-tenancy', 'exclusive use', 'kick-out'] },
  { id: 'dd_reports', name: 'DD Reports', icon: '🔍',
    keywords: ['environmental', 'phase i', 'phase ii', 'esa', 'asbestos', 'lead paint', 'mold', 'radon', 'ust', 'property condition', 'pcr', 'capital needs', 'roof', 'hvac', 'mechanical', 'inspection', 'ada', 'fire safety', 'nfpa', 'sprinkler', 'elevator', 'floor plan', 'site plan', 'building plan', 'as-built', 'pest control', 'deferred maintenance', 'appraisal'] },
  { id: 'financing', name: 'Financing / Lenders', icon: '🏦',
    keywords: ['loan', 'lender', 'term sheet', 'commitment letter', 'mortgage', 'debt', 'financing', 'loan application', 'loan document'] },
  { id: 'insurance', name: 'Insurance', icon: '🛡️',
    keywords: ['insurance', 'bop', 'umbrella', 'policy', 'coverage', 'endorsement', 'certificate of insurance', 'coi', 'loss run', 'claims history'] },
  { id: 'presentations', name: 'Presentations', icon: '📽️',
    keywords: ['presentation', 'deck', 'powerpoint', 'pptx', 'pitch', 'hebrew', 'english', 'financial model', 'model', 'underwriting'] },
  { id: 'site_visit', name: 'Site Visit', icon: '📸',
    keywords: ['site visit', 'photo', 'picture', 'image', 'aerial', 'drone', 'construction photo', 'interior photo', 'exterior photo'] },
  { id: 'investor_materials', name: 'Investor Materials', icon: '👥',
    keywords: ['investor', 'subscription', 'distribution', 'waterfall', 'lp', 'limited partner', 'faq'] },
  { id: 'post_closing', name: 'Post-Closing', icon: '✅',
    keywords: ['post-closing', 'post closing', 'recorded deed', 'final title', 'transition', 'tenant notification', 'utility transfer'] },
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
    return filePaths.map((p) => classifyByKeywords(p));
  }

  const anthropic = new Anthropic({ apiKey });

  const categoryList = DD_CATEGORIES.map((c) => `- ${c.id}: ${c.name} (${c.keywords.slice(0, 5).join(', ')}...)`).join('\n');

  const fileList = filePaths.map((p, i) => `${i + 1}. ${p}`).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a commercial real estate due diligence document classifier for RePrime Group.

Classify each file into exactly ONE of these 12 DD folder categories based on the filename and any folder path context:

${categoryList}

IMPORTANT RULES:
- Financial statements, rent rolls, tax bills, bank statements, utility bills → financials
- Leases, tenant files, eviction logs, estoppels → leases
- Environmental reports (Phase I/II ESA), property inspections, roof/HVAC reports → dd_reports
- Title, survey, zoning, deeds, contracts, service agreements → legal
- Insurance policies, loss runs → insurance
- Photos, site visit images → site_visit
- Presentations, models, decks → presentations
- Marketing materials, OMs, brochures → marketing
- Market research, comps, demographics → market_research
- Loan docs, term sheets → financing
- Investor materials, subscription docs → investor_materials
- Post-closing items → post_closing
- Only use "other" if truly unclassifiable

Files to classify:
${fileList}

Respond with ONLY a JSON array. Each element: {"index": <number>, "category": "<category_id>", "confidence": "high"|"medium"|"low"}

JSON only, no other text:`,
      },
    ],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
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
