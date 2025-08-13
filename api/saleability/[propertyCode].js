export default async function handler(req, res) {
  const { propertyCode } = req.query;
  const apiKey = process.env.VITE_SALEABILITY_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'Saleability API key not configured' });
  }

  try {
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
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    res.status(200).json(data);
  } catch (error) {
    console.error('Saleability API error:', error);
    res.status(500).json({ error: error.message });
  }
}
