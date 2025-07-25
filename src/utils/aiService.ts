import axios from 'axios';
import vision from '@google-cloud/vision';

// Types for AI analysis
export interface ImageAnalysis {
  caption: string;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  category: string;
  brand_detected?: string;
  colors_detected?: string[];
  condition_score: number; // 1-10
  features: string[];
}

export interface PriceSuggestion {
  suggested_price: number;
  reasoning: string;
  market_comparison: string;
  confidence_score: number; // 0-1
  factors: string[];
}

export interface ProductAnalysis {
  image_analysis: ImageAnalysis;
  price_suggestion: PriceSuggestion;
  final_recommendation: string;
  user_report: {
    condition: string;
    suggested_price: number;
    explanation: string;
    market_comparison?: string;
  };
}

// SERP API price fetcher
async function fetchSerpPrice(brand: string, category: string) {
  const SERP_API_KEY = process.env.SERP_API_KEY;
  if (!SERP_API_KEY) return null;
  try {
    const query = encodeURIComponent(`${brand} ${category} price India`);
    const url = `https://serpapi.com/search.json?q=${query}&engine=google_shopping&api_key=${SERP_API_KEY}`;
    const response = await axios.get(url);
    const products = response.data?.shopping_results || [];
    if (products.length > 0) {
      // Get min/max price from results
      const prices = products.map((p: any) => parseInt((p.price || '').replace(/[^\d]/g, ''))).filter(Boolean);
      if (prices.length > 0) {
        return {
          min: Math.min(...prices),
          max: Math.max(...prices),
          avg: Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length)
        };
      }
    }
    return null;
  } catch (err) {
    console.error('SERP API error:', err);
    return null;
  }
}

// Google Vision OCR for brand detection
async function detectBrandWithOCR(imageBase64: string): Promise<string | null> {
  try {
    const client = new vision.ImageAnnotatorClient();
    const [result] = await client.textDetection({ image: { content: imageBase64 } });
    const detections = result.textAnnotations;
    let text: string = '';
    if (detections && detections.length > 0 && typeof detections[0].description === 'string') {
      text = detections[0].description;
      console.log('Google Vision OCR text:', text); // Log the OCR text for debugging
    }
    // List of known brands (expand as needed)
    const brands = [
      'Nike', 'Adidas', 'Puma', 'Levi', 'French Connection', 'Zara', 'H&M', 'Gucci', 'Louis Vuitton', 'Reebok', 'Under Armour', 'Fila', 'Tommy Hilfiger', 'Calvin Klein', 'Superdry', 'Jack & Jones', 'UCB', 'United Colors of Benetton', 'Wrangler', 'Pepe Jeans', 'Lee', 'Allen Solly', 'Van Heusen', 'Arrow', 'Peter England', 'Raymond', 'Biba', 'W', 'Global Desi', 'Forever 21', 'Gap', 'Marks & Spencer', 'Mango', 'Boss', 'Diesel', 'Celio', 'Roadster', 'HRX', 'Mufti', 'Spykar', 'Flying Machine', 'S Oliver', 'S.Oliver', 'French Connection', 'FCUK'
    ];
    if (text) {
      for (const brand of brands) {
        if (text.toLowerCase().includes(brand.toLowerCase())) {
          return brand;
        }
      }
    }
    return null;
  } catch (err) {
    console.error('Google Vision OCR error:', err);
    return null;
  }
}

// Google Vision API for color detection
async function detectColorsWithVision(imageBase64: string): Promise<string[]> {
  try {
    const client = new vision.ImageAnnotatorClient();
    const [result] = await client.imageProperties({ image: { content: imageBase64 } });
    const colors = result.imagePropertiesAnnotation?.dominantColors?.colors;

    if (!colors || colors.length === 0) {
      return [];
    }

    // Convert RGB values to color names
    const detectedColors: string[] = [];

    // Get the top 2-3 most dominant colors
    const topColors = colors.slice(0, 3).filter(color => (color.score || 0) > 0.1);

    for (const color of topColors) {
      if (color.color?.red !== undefined && color.color?.green !== undefined && color.color?.blue !== undefined) {
        const colorName = rgbToColorName(
          Math.round(color.color.red || 0),
          Math.round(color.color.green || 0),
          Math.round(color.color.blue || 0)
        );
        if (colorName && !detectedColors.includes(colorName)) {
          detectedColors.push(colorName);
        }
      }
    }

    return detectedColors.slice(0, 2); // Return max 2 colors to avoid clutter
  } catch (err) {
    console.error('Google Vision color detection error:', err);
    return [];
  }
}

// Convert RGB values to human-readable color names
function rgbToColorName(r: number, g: number, b: number): string {
  // Define color ranges for common clothing colors
  const colorRanges = [
    { name: 'Black', r: [0, 50], g: [0, 50], b: [0, 50] },
    { name: 'White', r: [200, 255], g: [200, 255], b: [200, 255] },
    { name: 'Gray', r: [80, 180], g: [80, 180], b: [80, 180] },
    { name: 'Red', r: [150, 255], g: [0, 100], b: [0, 100] },
    { name: 'Blue', r: [0, 100], g: [0, 150], b: [150, 255] },
    { name: 'Navy', r: [0, 50], g: [0, 50], b: [100, 200] },
    { name: 'Green', r: [0, 150], g: [100, 255], b: [0, 150] },
    { name: 'Yellow', r: [200, 255], g: [200, 255], b: [0, 100] },
    { name: 'Orange', r: [200, 255], g: [100, 200], b: [0, 100] },
    { name: 'Purple', r: [100, 200], g: [0, 150], b: [150, 255] },
    { name: 'Pink', r: [200, 255], g: [150, 220], b: [150, 220] },
    { name: 'Brown', r: [100, 180], g: [50, 120], b: [20, 80] },
    { name: 'Beige', r: [200, 255], g: [180, 230], b: [140, 200] },
    { name: 'Khaki', r: [150, 200], g: [140, 190], b: [100, 150] }
  ];

  // Find the best matching color
  let bestMatch = 'Gray'; // Default fallback
  let minDistance = Infinity;

  for (const colorRange of colorRanges) {
    if (
      r >= colorRange.r[0] && r <= colorRange.r[1] &&
      g >= colorRange.g[0] && g <= colorRange.g[1] &&
      b >= colorRange.b[0] && b <= colorRange.b[1]
    ) {
      // Calculate distance from center of range
      const centerR = (colorRange.r[0] + colorRange.r[1]) / 2;
      const centerG = (colorRange.g[0] + colorRange.g[1]) / 2;
      const centerB = (colorRange.b[0] + colorRange.b[1]) / 2;

      const distance = Math.sqrt(
        Math.pow(r - centerR, 2) +
        Math.pow(g - centerG, 2) +
        Math.pow(b - centerB, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = colorRange.name;
      }
    }
  }

  return bestMatch;
}

// Gemini API for price suggestion
class GeminiService {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('Gemini API key not found. Price suggestions will be limited.');
    }
  }

  async suggestPrice(
    imageAnalysis: ImageAnalysis,
    productDetails: {
      article: string;
      brand: string;
      gender?: string;
      size?: string;
      age?: string;
      wear_count?: number;
      damage?: string;
    }
  ): Promise<PriceSuggestion> {
    if (!this.apiKey) {
      return this.fallbackPriceSuggestion(productDetails);
    }

    try {
      const prompt = this.buildPricePrompt(imageAnalysis, productDetails);
      
      const response = await axios.post(
        `${this.baseUrl}/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const suggestion = this.parseGeminiResponse(response.data);
      return suggestion;
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.fallbackPriceSuggestion(productDetails);
    }
  }

  async suggestPriceWithSerp(
    imageAnalysis: ImageAnalysis,
    productDetails: any,
    serpPrices: { min: number; max: number; avg: number } | null
  ): Promise<PriceSuggestion> {
    if (!this.apiKey) {
      return this.fallbackPriceSuggestion(productDetails, serpPrices);
    }
    try {
      const prompt = this.buildPricePromptWithSerp(imageAnalysis, productDetails, serpPrices);
      const response = await axios.post(
        `${this.baseUrl}/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }]
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const suggestion = this.parseGeminiResponse(response.data);
      return suggestion;
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.fallbackPriceSuggestion(productDetails, serpPrices);
    }
  }

  private buildPricePrompt(imageAnalysis: ImageAnalysis, productDetails: any): string {
    return `You are an expert fashion appraiser for a second-hand clothing marketplace called ReTag. \n\nAnalyze this item and suggest a fair market price in Indian Rupees (INR):\n\n**Item Details:**\n- Article: ${productDetails.article}\n- Brand: ${productDetails.brand}\n- Gender: ${productDetails.gender || 'Not specified'}\n- Size: ${productDetails.size || 'Not specified'}\n- Age: ${productDetails.age || 'Not specified'}\n- Times worn: ${productDetails.wear_count || 'Not specified'}\n- Damage: ${productDetails.damage || 'None reported'}\n\n**AI Image Analysis:**\n- Caption: ${imageAnalysis.caption}\n- Quality: ${imageAnalysis.quality}\n- Category: ${imageAnalysis.category}\n- Condition Score: ${imageAnalysis.condition_score}/10\n- Features: ${imageAnalysis.features.join(', ')}\n\n**Market Context:**\n- This is for the Indian market\n- Consider similar items on platforms like Myntra, Amazon, Flipkart\n- Factor in the second-hand nature and condition\n- Be conservative but fair\n\n**Response Format (JSON only):**\n{\n  "suggested_price": <price_in_inr>,\n  "reasoning": "<detailed explanation>",\n  "market_comparison": "<comparison with new prices>",\n  "confidence_score": <0.0-1.0>,\n  "factors": ["factor1", "factor2", "factor3"]\n}\n\nProvide only the JSON response, no additional text.`;
  }

  private buildPricePromptWithSerp(
    imageAnalysis: ImageAnalysis,
    productDetails: any,
    serpPrices: { min: number; max: number; avg: number } | null
  ): string {
    let serpText = '';
    if (serpPrices) {
      serpText = `\n\n**Market Price Reference:**\n- New items of this brand/category in India are typically priced between ₹${serpPrices.min} and ₹${serpPrices.max} (avg: ₹${serpPrices.avg}).`;
    }
    return `You are an expert fashion appraiser for a second-hand clothing marketplace.\n\nAnalyze this item and suggest a fair resale price in Indian Rupees (INR) for a used/pre-owned item.\n\n**Instructions:**\n- The resale price should typically be 40–60% of the new price, depending on condition, age, and times worn.\n- Be conservative and realistic.\n- Consider the second-hand nature, wear, and any reported damage.\n- Do NOT mention any competitor or e-commerce platform by name.\n- Use only the information below.\n- Provide only the JSON response, no additional text.\n\n**Item Details:**\n- Article: ${productDetails.article}\n- Brand: ${productDetails.brand}\n- Gender: ${productDetails.gender || 'Not specified'}\n- Size: ${productDetails.size || 'Not specified'}\n- Age: ${productDetails.age || 'Not specified'}\n- Times worn: ${productDetails.wear_count || 'Not specified'}\n- Damage: ${productDetails.damage || 'None reported'}\n\n**AI Image Analysis:**\n- Caption: ${imageAnalysis.caption}\n- Quality: ${imageAnalysis.quality}\n- Category: ${imageAnalysis.category}\n- Condition Score: ${imageAnalysis.condition_score}/10\n- Features: ${imageAnalysis.features.join(', ')}${serpText}\n\n**Response Format (JSON only):**\n{\n  "suggested_price": <price_in_inr>,\n  "reasoning": "<detailed explanation>",\n  "market_comparison": "<comparison with new prices>",\n  "confidence_score": <0.0-1.0>,\n  "factors": ["factor1", "factor2", "factor3"]\n}`;
  }

  private parseGeminiResponse(response: any): PriceSuggestion {
    try {
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          suggested_price: parsed.suggested_price || 500,
          reasoning: parsed.reasoning || 'Based on market analysis',
          market_comparison: parsed.market_comparison || 'Comparable to similar items',
          confidence_score: parsed.confidence_score || 0.7,
          factors: parsed.factors || ['brand', 'condition', 'market demand']
        };
      }
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
    }
    
    return this.fallbackPriceSuggestion({});
  }

  // Optionally, apply a discount factor in fallbackPriceSuggestion
  private fallbackPriceSuggestion(productDetails: any, serpPrices?: { min: number; max: number; avg: number } | null): PriceSuggestion {
    // Use SERP price if available, otherwise base price
    let basePrice = 500;
    if (serpPrices && serpPrices.avg) {
      // Apply 40–60% discount for used items
      basePrice = Math.round(serpPrices.avg * 0.5);
    } else if (productDetails.brand?.toLowerCase().includes('nike')) {
      basePrice = 800;
    }
    return {
      suggested_price: basePrice,
      reasoning: 'Based on standard market rates for second-hand clothing (typically 40–60% of new price)',
      market_comparison: 'Similar to other pre-owned items in the market',
      confidence_score: 0.6,
      factors: ['brand reputation', 'general condition', 'market demand']
    };
  }
}

// Main AI service class
export class AIService {
  private gemini: GeminiService;

  constructor() {
    this.gemini = new GeminiService();
  }

  // Simple local image analysis as a placeholder
  private localImageAnalysis(imageBase64: string, userCategory: string): ImageAnalysis {
    // In production, you may want to use Gemini Vision or another service
    return {
      caption: 'Clothing item in good condition',
      quality: 'good',
      category: userCategory, // Use user-selected category
      condition_score: 7,
      features: ['standard clothing item']
    };
  }

  // HuggingFace image analysis
  async analyzeImageWithHuggingFace(imageBase64: string) {
    const HF_API_TOKEN = process.env.HUGGING_FACE_API_KEY;
    if (!HF_API_TOKEN) {
      throw new Error('HuggingFace API key not found');
    }
    try {
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/google/vit-base-patch16-224',
        { inputs: imageBase64 },
        {
          headers: {
            Authorization: `Bearer ${HF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
      return response.data;
    } catch (error) {
      console.error('HuggingFace API error:', error);
      throw new Error('Failed to analyze image with HuggingFace');
    }
  }

  async analyzeProduct(
    images: string[], // Base64 encoded images
    productDetails: {
      article: string;
      brand: string;
      category: string;
      gender?: string;
      size?: string;
      age?: string;
      wear_count?: number;
      damage?: string;
    }
  ): Promise<ProductAnalysis> {
    try {
      // Use HuggingFace for image analysis
      let imageAnalysis: ImageAnalysis;
      let hfResult;
      let detectedBrand: string | null = null;
      try {
        hfResult = await this.analyzeImageWithHuggingFace(images[0]);
        // Parse HuggingFace result
        const label = hfResult?.[0]?.label || 'unknown';
        const score = hfResult?.[0]?.score || 0.5;
        // OCR for brand detection
        detectedBrand = await detectBrandWithOCR(images[0]);
        // Color detection
        const detectedColors = await detectColorsWithVision(images[0]);
        imageAnalysis = {
          caption: `Detected as: ${label}`,
          quality: score > 0.8 ? 'excellent' : score > 0.6 ? 'good' : score > 0.4 ? 'fair' : 'poor',
          category: productDetails.category, // Use user-selected category instead of AI-detected
          brand_detected: detectedBrand || undefined,
          colors_detected: detectedColors.length > 0 ? detectedColors : undefined,
          condition_score: Math.round(score * 10),
          features: [label]
        };
      } catch (err) {
        // Fallback to local analysis if HuggingFace fails
        imageAnalysis = this.localImageAnalysis(images[0], productDetails.category);
      }
      // Use detected brand if found
      const brandForPricing = detectedBrand || productDetails.brand;
      // Fetch real prices from SERP API
      const serpPrices = await fetchSerpPrice(brandForPricing, imageAnalysis.category);
      // Get price suggestion using Gemini
      const priceSuggestion = await this.gemini.suggestPriceWithSerp(imageAnalysis, { ...productDetails, brand: brandForPricing }, serpPrices);
      // Generate final recommendation
      const finalRecommendation = this.generateFinalRecommendation(imageAnalysis, priceSuggestion);
      // Generate user-facing report
      let userCondition = '';
      switch (imageAnalysis.quality) {
        case 'excellent': userCondition = 'Excellent'; break;
        case 'good': userCondition = 'Good'; break;
        case 'fair': userCondition = 'Fair'; break;
        case 'poor': userCondition = 'Poor'; break;
        default: userCondition = 'Good';
      }
      const userReport = {
        condition: userCondition,
        suggested_price: priceSuggestion.suggested_price,
        explanation: `Based on your item's brand, its ${userCondition.toLowerCase()} condition, and current market trends, this is a fair resale price for your ${imageAnalysis.category}.`,
        market_comparison: serpPrices ? `New ${brandForPricing} ${imageAnalysis.category} typically sell for ₹${serpPrices.min}–₹${serpPrices.max}.` : undefined
      };
      return {
        image_analysis: imageAnalysis,
        price_suggestion: priceSuggestion,
        final_recommendation: finalRecommendation,
        user_report: userReport
      };
    } catch (error) {
      console.error('AI analysis error:', error);
      throw new Error('Failed to analyze product');
    }
  }

  private generateFinalRecommendation(
    imageAnalysis: ImageAnalysis,
    priceSuggestion: PriceSuggestion
  ): string {
    const quality = imageAnalysis.quality;
    const confidence = priceSuggestion.confidence_score;
    
    if (confidence > 0.8) {
      return `High confidence recommendation: ₹${priceSuggestion.suggested_price}. ${priceSuggestion.reasoning}`;
    } else if (confidence > 0.6) {
      return `Moderate confidence recommendation: ₹${priceSuggestion.suggested_price}. Consider admin review for final pricing.`;
    } else {
      return `Low confidence recommendation: ₹${priceSuggestion.suggested_price}. Requires admin review and manual pricing.`;
    }
  }
}

export default new AIService(); 