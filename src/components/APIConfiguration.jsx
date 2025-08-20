import React, { useState } from 'react';
import { fetchPriceRulesFromAPI, fetchSaleabilityFromAPI } from '../services/apiService.js';

/**
 * API Configuration component for setting up API endpoint and making requests
 */
export default function APIConfiguration({ onRulesLoaded, searchHistory, onAddToHistory, onSaleabilityLoaded, saleabilityData }) {
  const [accommodationCode, setAccommodationCode] = useState('');
  const [season, setSeason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Generate season options (current year and next few years)
  const currentYear = new Date().getFullYear();
  const seasonOptions = [];
  for (let year = currentYear; year <= currentYear + 5; year++) {
    seasonOptions.push(year);
  }

  const handleFetchFromAPI = async () => {
    if (!accommodationCode || !season) {
      alert('Please fill in all fields: accommodation code and season');
      return;
    }

    setIsLoading(true);
    try {
      let allRules = [];

      if (season === 'all') {
        // Fetch both current and next year
        const currentYear = new Date().getFullYear();
        const seasons = [currentYear, currentYear + 1];
        
        for (const yearSeason of seasons) {
          const payload = {
            salesmarket: 999,
            season: yearSeason,
            showdescriptions: true,
            sections: 'pricerules'
          };

          try {
            const rules = await fetchPriceRulesFromAPI(accommodationCode, payload);
            allRules = [...allRules, ...rules];
          } catch (error) {
            console.warn(`Failed to fetch rules for season ${yearSeason}:`, error.message);
            // Continue with other seasons even if one fails
          }
        }
        
        // Re-assign IDs to ensure they're unique across all rules
        allRules = allRules.map((rule, index) => ({
          ...rule,
          id: index + 1
        }));

        // Add to search history with 'all' indicator
        onAddToHistory({ accommodationCode, season: 'all' });
      } else {
        // Fetch single season
        const payload = {
          salesmarket: 999,
          season: parseInt(season, 10),
          showdescriptions: true,
          sections: 'pricerules'
        };

        allRules = await fetchPriceRulesFromAPI(accommodationCode, payload);
        
        // Add to search history
        onAddToHistory({ accommodationCode, season: parseInt(season, 10) });
      }

      onRulesLoaded(allRules);

      // Automatically fetch saleability data using the same accommodation code
      try {
        const saleabilityData = await fetchSaleabilityFromAPI(accommodationCode);
        onSaleabilityLoaded(saleabilityData);
      } catch (error) {
        console.warn('Failed to fetch saleability data:', error.message);
        // Don't show alert for saleability failure, just warn in console
        // The price rules were successful, so we continue
      }

    } catch (error) {
      console.error('Failed to fetch from API:', error);
      alert(`Failed to fetch price rules from API: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle clicking on a history item
  const handleHistoryClick = (historyItem) => {
    setAccommodationCode(historyItem.accommodationCode);
    setSeason(historyItem.season === 'all' ? 'all' : historyItem.season.toString());
  };

  return (
    <div className="api-configuration">
      <h3>Fetch from API</h3>
      <div className="api-form">
        <div className="api-form-row">
          <label>
            Accommodation Code:
            <input
              type="text"
              value={accommodationCode}
              onChange={(e) => setAccommodationCode(e.target.value)}
              placeholder="e.g., FRA278"
              className="api-input"
            />
          </label>
          <label>
            Season:
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="api-input"
            >
              <option value="">Select season...</option>
              <option value="all">All (Current & Next Year)</option>
              {seasonOptions.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={handleFetchFromAPI}
            disabled={isLoading}
            className="api-fetch-button"
          >
            {isLoading ? 'Fetching...' : 'Fetch Rules & Availability'}
          </button>
        </div>
        
        {/* Search History */}
        {searchHistory.length > 0 && (
          <div className="search-history">
            <h4>Search History</h4>
            <div className="history-buttons">
              {searchHistory.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleHistoryClick(item)}
                  className="history-button"
                  title={`Click to search ${item.accommodationCode} for season ${item.season === 'all' ? 'All (Current & Next Year)' : item.season}`}
                >
                  {item.accommodationCode} ({item.season === 'all' ? 'All' : item.season})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
