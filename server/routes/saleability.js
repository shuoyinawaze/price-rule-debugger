/**
 * Saleability API Route Handler
 * Fetches saleability data from the Awaze APEX API
 */
export async function saleabilityHandler(req, res) {
  const { propertyCode } = req.params;
  const apiKey = process.env.VITE_SALEABILITY_API_KEY;
  
  // Validation
  if (!propertyCode) {
    return res.status(400).json({ 
      error: 'Property code is required',
      timestamp: new Date().toISOString()
    });
  }
  
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Saleability API key not configured. Please set VITE_SALEABILITY_API_KEY in environment variables.',
      timestamp: new Date().toISOString()
    });
  }

  try {
    console.log(`🔍 Fetching saleability data for property ${propertyCode}`);
    
    const response = await fetch(
      `https://saleability-api.apex.awaze.com/saleability/${propertyCode}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-awaze-client': 'price-rule-debugger',
          'x-awaze-client-env': 'prod',
          'x-api-key': apiKey,
          'x-apex-expose-novasol-saleability': 'true'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Saleability API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Successfully fetched saleability data for ${propertyCode}`);
    
    res.status(200).json(data);
  } catch (error) {
    console.error('❌ Saleability API error:', error);
    res.status(500).json({ 
      error: error.message,
      propertyCode,
      timestamp: new Date().toISOString()
    });
  }
}
