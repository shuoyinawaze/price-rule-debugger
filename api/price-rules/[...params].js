export default async function handler(req, res) {
  const { params } = req.query;
  const accommodationCode = params[0];
  const { season, salesmarket = 999 } = req.query;

  const apiKey = process.env.VITE_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
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
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.text();
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/xml');
    
    res.status(200).send(data);
  } catch (error) {
    console.error('Price rules API error:', error);
    res.status(500).json({ error: error.message });
  }
}
