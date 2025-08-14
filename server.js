import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Allow self-signed certificates in development
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API server is running' });
});

// PDP/Checkout availability endpoint
app.get('/api/pdp/:propertyCode', async (req, res) => {
  const { propertyCode } = req.params;
  const { startDate, lengthOfStay } = req.query;
  
  if (!startDate || !lengthOfStay) {
    return res.status(400).json({ error: 'startDate and lengthOfStay parameters are required' });
  }

  try {
    // Calculate end date based on start date and length of stay
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + parseInt(lengthOfStay));
    
    // Format dates as DD-MM-YYYY (matching expected format)
    const formattedStartDate = start.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-');
    const formattedEndDate = end.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-');

    // Log the exact URL being called for debugging
    const checkoutUrl = `https://checkout.novasol.com/?acode=${propertyCode}&ucode=${propertyCode}&start=${formattedStartDate}&nights=${lengthOfStay}&adult=2&child=0&infant=0&pets=0&pdpAmt=627&contentfulLocale=en-EU&L=999&correlationId=pdpmfe-8ce29320-2805-4e9f-a07f4621af6e77e6&COM=NOV&cookieInfo=%7B%22consents_approved%22:%7B%22essential%22:true,%22functional%22:true,%22marketing%22:true,%22customCategory-bd2b6280-b698-4e46-92ef-9f90ee36d38b%22:true%7D,%22controllerId%22:%22a1cd89656973361465dd0b5c67e448bc597925c2dde8bce3546e51856cdf44e7%22,%22timestamp%22:1743588001242%7D&fbp=fb.1.1739355530995.492149450820141830&optId=lpmfe-68ec2eb1-4aba-4028-bc27-088c5b8e9330&tms_cdc=_gcl_aw=GCL.1753702706.CjwKCAjwv5zEBhBwEiwAOg2YKBdItFms1Kw2B2wlUrzGt_6gpcO15ICTsdC9dJemnL50p9oHDeV1UxoCJNMQAvD_BwE%7C_gcl_au=1.1.1969661558.1749027646%7C_ga=GA1.1.471657070.1740066453%7C_ga_9ZSCBMZE7K=GS2.1.s1754474997$o21$g0$t1754475074$j60$l0$h0%7C_ga_64GK8876W2=GS2.1.s1755168201$o41$g1$t1755168279$j52$l0$h0%7C_ga_M4XVYVV45D=GS2.1.s1755168201$o36$g0$t1755168280$j51$l0$h2093388745%7C_ga_8X5QYZ1MRT=GS2.1.s1755168201$o39$g1$t1755168973$j58$l0$h0%7Ct=1755168999735&end=${formattedEndDate}&exp=newage`;

    const response = await fetch(checkoutUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive'
      }
    });

    console.log(`Checkout API called for ${propertyCode}, start: ${formattedStartDate}, nights: ${lengthOfStay}`);
    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Error response body: ${errorText}`);
      throw new Error(`Checkout API request failed: ${response.status} ${response.statusText}`);
    }

    const htmlData = await response.text();
    // Check if the error message exists in the HTML
    const hasError = !htmlData.includes('quoteResponse');
    
    // Return true if no error, false if error exists
    res.status(200).json({ success: !hasError });
  } catch (error) {
    console.error('Checkout API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Saleability endpoint
app.get('/api/saleability/:propertyCode', async (req, res) => {
  const { propertyCode } = req.params;
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
    res.status(200).json(data);
  } catch (error) {
    console.error('Saleability API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Price rules endpoint
app.get('/api/price-rules/:accommodationCode', async (req, res) => {
  const { accommodationCode } = req.params;
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
      throw new Error(`Price rules API request failed: ${response.status} ${response.statusText}`);
    }
    
    const xmlText = await response.text();
    res.set('Content-Type', 'application/xml');
    res.status(200).send(xmlText);
  } catch (error) {
    console.error('Price rules API error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
