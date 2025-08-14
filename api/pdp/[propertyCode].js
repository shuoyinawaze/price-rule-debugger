export default async function handler(req, res) {
  const { propertyCode, startDate, lengthOfStay } = req.query;

  if (!startDate || !lengthOfStay) {
    return res.status(400).json({ error: 'startDate and lengthOfStay parameters are required' });
  }

  try {
    // Calculate end date based on start date and length of stay
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + parseInt(lengthOfStay));
    
    // Format dates as YYYY-MM-DD
    const formattedStartDate = start.toISOString().split('T')[0];
    const formattedEndDate = end.toISOString().split('T')[0];

    const response = await fetch(
      `https://checkout.novasol.com/?acode=${propertyCode}&ucode=${propertyCode}&start=${formattedStartDate}&nights=${lengthOfStay}&adult=2&child=0&infant=0&pets=0&pdpAmt=627&contentfulLocale=en-EU&L=999&correlationId=pdpmfe-8ce29320-2805-4e9f-a07f4621af6e77e6&COM=NOV&cookieInfo=%7B%22consents_approved%22:%7B%22essential%22:true,%22functional%22:true,%22marketing%22:true,%22customCategory-bd2b6280-b698-4e46-92ef-9f90ee36d38b%22:true%7D,%22controllerId%22:%22a1cd89656973361465dd0b5c67e448bc597925c2dde8bce3546e51856cdf44e7%22,%22timestamp%22:1743588001242%7D&fbp=fb.1.1739355530995.492149450820141830&optId=lpmfe-68ec2eb1-4aba-4028-bc27-088c5b8e9330&tms_cdc=_gcl_aw=GCL.1753702706.CjwKCAjwv5zEBhBwEiwAOg2YKBdItFms1Kw2B2wlUrzGt_6gpcO15ICTsdC9dJemnL50p9oHDeV1UxoCJNMQAvD_BwE%7C_gcl_au=1.1.1969661558.1749027646%7C_ga=GA1.1.471657070.1740066453%7C_ga_9ZSCBMZE7K=GS2.1.s1754474997$o21$g0$t1754475074$j60$l0$h0%7C_ga_64GK8876W2=GS2.1.s1755168201$o41$g1$t1755168279$j52$l0$h0%7C_ga_M4XVYVV45D=GS2.1.s1755168201$o36$g0$t1755168280$j51$l0$h2093388745%7C_ga_8X5QYZ1MRT=GS2.1.s1755168201$o39$g1$t1755168973$j58$l0$h0%7Ct=1755168999735&end=${formattedEndDate}&exp=newage`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'text/html',
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Checkout API request failed: ${response.status} ${response.statusText}`);
    }

    const htmlData = await response.text();
    
    // Check if the error element exists in the HTML
    const hasError = htmlData.includes('<h4 class="text__TextThemed-sc-1mhdgwc-0 text__TextStyled-sc-1mhdgwc-1  iwfrbg" sizes="300" color="currentColor">Oops, something went wrong!</h4>');
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Return true if no error, false if error exists
    res.status(200).json({ success: !hasError });
  } catch (error) {
    console.error('Checkout API error:', error);
    res.status(500).json({ error: error.message });
  }
}
