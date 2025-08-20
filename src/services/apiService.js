import { parseXmlRules } from '../utils/ruleUtils.js';

/**
 * Fetch price rules from API endpoint
 * @param {string} accommodationCode The accommodation code
 * @param {Object} payload The request payload
 * @returns {Promise<Array>} Array of rule objects
 */
export async function fetchPriceRulesFromAPI(accommodationCode, payload) {
  // Use your Express API route (running on port 3001)
  // The Express server handles the API key authentication
  const response = await fetch(
    `http://localhost:3001/api/price-rules/${accommodationCode}?season=${payload.season}&salesmarket=${payload.salesmarket || 999}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  const xmlText = await response.text();
  return parseXmlRules(xmlText);
}

/**
 * Fetch saleability data from API endpoint
 * @param {string} propertyCode The property code
 * @returns {Promise<Object>} Saleability data object
 */
export async function fetchSaleabilityFromAPI(propertyCode) {
  // Use your Express API route (running on port 3001)
  // The Express server handles the API key authentication
  const response = await fetch(
    `http://localhost:3001/api/saleability/${propertyCode}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Saleability API request failed: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
}

/**
 * Test checkout availability for a specific booking
 * @param {string} propertyCode The property code
 * @param {string} startDate The start date (YYYY-MM-DD)
 * @param {number} lengthOfStay The length of stay in nights
 * @returns {Promise<Object>} Checkout availability result
 */
export async function testCheckoutAvailability(propertyCode, startDate, lengthOfStay) {
  // Use your Express API route (running on port 3001)
  const response = await fetch(
    `http://localhost:3001/api/pdp/${propertyCode}?startDate=${startDate}&lengthOfStay=${lengthOfStay}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Checkout API request failed: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
}
