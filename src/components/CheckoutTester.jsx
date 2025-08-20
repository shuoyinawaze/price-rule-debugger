import React, { useState } from 'react';
import { testCheckoutAvailability } from '../services/apiService.js';

/**
 * CheckoutTester allows users to test checkout availability for specific bookings
 */
export default function CheckoutTester() {
  const [propertyCode, setPropertyCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [lengthOfStay, setLengthOfStay] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleTestCheckout = async () => {
    // Trim values and check more robustly
    const trimmedPropertyCode = propertyCode.trim();
    const trimmedStartDate = startDate.trim();
    const trimmedLengthOfStay = lengthOfStay.trim();
    
    console.log('Form values:', { 
      propertyCode: `"${trimmedPropertyCode}"`, 
      startDate: `"${trimmedStartDate}"`, 
      lengthOfStay: `"${trimmedLengthOfStay}"` 
    });
    
    if (!trimmedPropertyCode || !trimmedStartDate || !trimmedLengthOfStay) {
      alert('Please fill in all fields: property code, start date, and length of stay');
      return;
    }

    // Validate length of stay is a positive number
    const lengthOfStayNumber = parseInt(trimmedLengthOfStay, 10);
    if (isNaN(lengthOfStayNumber) || lengthOfStayNumber <= 0) {
      alert('Length of stay must be a positive number');
      return;
    }

    // Validate start date is a valid date
    const startDateObj = new Date(trimmedStartDate);
    if (isNaN(startDateObj.getTime())) {
      alert('Please enter a valid start date');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const result = await testCheckoutAvailability(trimmedPropertyCode, trimmedStartDate, lengthOfStayNumber);
      setResult(result);
    } catch (error) {
      console.error('Failed to test checkout:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearResults = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="checkout-tester">
      <h3>Test Checkout Availability</h3>
      <p>Test if a specific booking can proceed to checkout without errors.</p>
      
      <div className="checkout-form">
        <div className="checkout-form-row">
          <label>
            Property Code:
            <input
              type="text"
              value={propertyCode}
              onChange={(e) => setPropertyCode(e.target.value)}
              placeholder="e.g., FRA278"
              className="checkout-input"
            />
          </label>
          <label>
            Start Date:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="checkout-input"
            />
          </label>
          <label>
            Length of Stay (nights):
            <input
              type="number"
              min="1"
              max="365"
              value={lengthOfStay}
              onChange={(e) => {
                const value = e.target.value;
                // Only allow positive numbers
                if (value === '' || (parseInt(value, 10) > 0 && parseInt(value, 10) <= 365)) {
                  setLengthOfStay(value);
                }
              }}
              placeholder="7"
              className="checkout-input"
            />
          </label>
          <button
            onClick={handleTestCheckout}
            disabled={isLoading}
            className="checkout-test-button"
          >
            {isLoading ? 'Testing...' : 'Test Checkout'}
          </button>
          {(result || error) && (
            <button
              onClick={handleClearResults}
              className="checkout-clear-button"
            >
              Clear Results
            </button>
          )}
        </div>
        
        {/* Results Display */}
        {result && (
          <div className={`checkout-result ${result.success ? 'success' : 'error'}`}>
            <h4>Checkout Test Result:</h4>
            {result.success ? (
              <div className="success-message">
                <span className="status-icon">✅</span>
                <span>Booking is available - checkout would proceed normally</span>
              </div>
            ) : (
              <div className="error-message">
                <span className="status-icon">❌</span>
                <span>Booking has issues - checkout would show error page</span>
              </div>
            )}
            <div className="test-details">
              <p><strong>Property:</strong> {propertyCode}</p>
              <p><strong>Check-in:</strong> {startDate}</p>
              <p><strong>Nights:</strong> {lengthOfStay}</p>
              <p><strong>Check-out:</strong> {(() => {
                try {
                  const checkIn = new Date(startDate);
                  const nights = parseInt(lengthOfStay, 10);
                  
                  // Validate that we have valid numbers
                  if (isNaN(nights) || nights <= 0) {
                    return 'Invalid length of stay';
                  }
                  
                  const checkOut = new Date(checkIn);
                  checkOut.setDate(checkIn.getDate() + nights);
                  
                  // Validate that the result is a valid date
                  if (isNaN(checkOut.getTime())) {
                    return 'Invalid date';
                  }
                  
                  return checkOut.toISOString().split('T')[0];
                } catch (error) {
                  console.error('Error calculating checkout date:', error);
                  return 'Error calculating date';
                }
              })()}</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="checkout-result error">
            <h4>Error:</h4>
            <div className="error-message">
              <span className="status-icon">⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
