/**
 * Price Rules API Route Handler
 * Fetches price rules from the internal NOVASOL API
 */
export async function priceRulesHandler(req, res) {
  const { accommodationCode } = req.params;
  const { season, salesmarket = 999 } = req.query;
  const apiKey = process.env.VITE_API_KEY;
  
  // Validation
  if (!accommodationCode) {
    return res.status(400).json({ 
      error: 'Accommodation code is required',
      timestamp: new Date().toISOString()
    });
  }
  
  if (!season) {
    return res.status(400).json({ 
      error: 'Season parameter is required',
      timestamp: new Date().toISOString()
    });
  }
  
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'API key not configured. Please set VITE_API_KEY in environment variables.',
      timestamp: new Date().toISOString()
    });
  }

  try {
    console.log(`🔍 Fetching price rules for ${accommodationCode}, season: ${season}, salesmarket: ${salesmarket}`);
    
    const response = await fetch(
      `http://internalapi.novasol.com/api/products/${accommodationCode}?salesmarket=${salesmarket}&season=${season}&showdescriptions=true&sections=pricerules`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Key': apiKey
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Price rules API request failed: ${response.status} ${response.statusText}`);
    }
    
    const xmlText = await response.text();
    console.log(`✅ Successfully fetched price rules for ${accommodationCode}`);
    
    res.set('Content-Type', 'application/xml');
    res.status(200).send(xmlText);
  } catch (error) {
    console.error('❌ Price rules API error:', error);
    res.status(500).json({ 
      error: error.message,
      accommodationCode,
      season,
      timestamp: new Date().toISOString()
    });
  }
}
