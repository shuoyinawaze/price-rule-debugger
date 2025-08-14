import { parseISO, differenceInCalendarDays, startOfYear, endOfYear, format, isAfter, isBefore } from 'date-fns';
import './App.css';
import React, { useRef, useEffect, useState, useMemo } from 'react';

// A palette of colours used to render the rule bars. When more rules
// are defined than there are colours, the palette cycles.
const COLOURS = [
  '#0072B2', // Blue
  '#D55E00', // Vermillion
  '#F0E442', // Yellow
  '#009E73', // Green
  '#CC79A7', // Magenta
  '#56B4E9', // Sky blue
  '#E69F00', // Orange
  '#8B4513'  // SaddleBrown (replacing black)
];

/**
 * Parse XML into an array of rule objects. Each rule object
 * normalises the dates into ISO strings and assigns a colour.
 * @param {string} text The raw XML string
 * @returns {Array} An array of rule objects
 */
function parseXmlRules(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  const errorNode = doc.querySelector('parsererror');
  if (errorNode) {
    throw new Error('Invalid XML file');
  }
  
  // Check if this is an API response with nested structure
  const priceRulesNode = doc.querySelector('priceRules');
  const ruleNodes = priceRulesNode 
    ? Array.from(priceRulesNode.getElementsByTagName('rule'))
    : Array.from(doc.getElementsByTagName('rule'));
    
  return ruleNodes.map((node, idx) => {
    const getTag = (tag) => {
      const el = node.getElementsByTagName(tag)[0];
      return el ? el.textContent.trim() : null;
    };
    const from = getTag('from');
    const to = getTag('to');
    
    // Serialize the original XML node for this rule
    const serializer = new XMLSerializer();
    const originalXml = serializer.serializeToString(node);
    
    return {
      id: idx + 1,
      from,
      to,
      percentage: getTag('percentage') ? parseFloat(getTag('percentage')) : null,
      arrivalWeekdays: getTag('arrivalWeekdays')
        ? getTag('arrivalWeekdays')
            .split(',')
            .map((w) => parseInt(w, 10))
        : [],
      minStay: getTag('minStay') ? parseInt(getTag('minStay'), 10) : null,
      maxStay: getTag('maxStay') ? parseInt(getTag('maxStay'), 10) : null,
      maxDaysToArrival: getTag('maxDaysToArrival')
        ? parseInt(getTag('maxDaysToArrival'), 10)
        : null,
      colour: COLOURS[idx % COLOURS.length],
      originalXml: originalXml // Store the original XML
    };
  });
}

/**
 * Fetch price rules from API endpoint
 * @param {string} accommodationCode The accommodation code
 * @param {Object} payload The request payload
 * @returns {Promise<Array>} Array of rule objects
 */
async function fetchPriceRulesFromAPI(accommodationCode, payload) {
  const apiKey = import.meta.env.VITE_API_KEY;
  
  if (!apiKey) {
    throw new Error('API key not configured. Please set VITE_API_KEY in your .env file.');
  }

  // Always use our Express API route (works in both dev and production)
  const response = await fetch(
    `/api/price-rules/${accommodationCode}?season=${payload.season}&salesmarket=${payload.salesmarket || 999}`,
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
async function fetchSaleabilityFromAPI(propertyCode) {
  const saleabilityApiKey = import.meta.env.VITE_SALEABILITY_API_KEY;
  
  if (!saleabilityApiKey) {
    throw new Error('Saleability API key not configured. Please set VITE_SALEABILITY_API_KEY in your .env file.');
  }

  // Always use our Express API route (works in both dev and production)
  const response = await fetch(
    `/api/saleability/${propertyCode}`,
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
async function testCheckoutAvailability(propertyCode, startDate, lengthOfStay) {
  // Always use the API route (works in both dev and production)
  const response = await fetch(
    `/api/pdp/${propertyCode}?startDate=${startDate}&lengthOfStay=${lengthOfStay}`,
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

/**
 * Determine whether a booking defined by a start date and length of stay
 * satisfies a given price rule. The rules for matching are:
 *   - The start date must fall within the rule's [from, to] range
 *   - The length of stay must fall between minStay and maxStay inclusive
 *   - If maxDaysToArrival is defined, the difference between the booking
 *     start date and the booking creation date must not exceed it
 *   - If arrivalWeekdays is defined, the weekday of the start date must
 *     be permitted
 * @param {Object} rule The price rule to test against
 * @param {string} startDate ISO string representing the booking arrival date
 * @param {number} length Number of nights
 * @param {Date} bookingCreationDate Date representing "today"
 * @returns {boolean} True if the booking meets all constraints
 */
function isBookingAllowedByRule(rule, startDate, length, bookingCreationDate) {
  if (!startDate || !length) return false;
  const arrival = parseISO(startDate);
  const ruleStart = parseISO(rule.from);
  const ruleEnd = parseISO(rule.to);
  // Check date range
  if (isBefore(arrival, ruleStart) || isAfter(arrival, ruleEnd)) return false;
  // Check stay length
  if ((rule.minStay && length < rule.minStay) || (rule.maxStay && length > rule.maxStay)) {
    return false;
  }
  // Check maxDaysToArrival (difference between arrival and booking creation date)
  if (rule.maxDaysToArrival != null) {
    const diff = differenceInCalendarDays(arrival, bookingCreationDate);
    if (diff > rule.maxDaysToArrival) return false;
  }
  // Check arrival weekdays (1-7 where 1 is Monday, 7 is Sunday)
  if (rule.arrivalWeekdays && rule.arrivalWeekdays.length > 0) {
    // JavaScript: 0 (Sunday) -> 7 (Sunday) mapping; but our rule uses 1-7 (Monday-Sunday)
    const jsDay = arrival.getDay(); // 0..6 (Sun..Sat)
    const weekday = jsDay === 0 ? 7 : jsDay; // convert to 1..7
    if (!rule.arrivalWeekdays.includes(weekday)) return false;
  }
  return true;
}


/**
 * XML Popup Modal component to display the original XML for a rule
 */
function XMLPopup({ rule, onClose }) {
  if (!rule) return null;

  // Format XML with proper indentation
  const formatXml = (xml) => {
    const PADDING = ' '.repeat(2);
    const reg = /(>)(<)(\/*)/g;
    let formatted = xml.replace(reg, '$1\r\n$2$3');
    let pad = 0;
    return formatted.split('\r\n').map(line => {
      let indent = 0;
      if (line.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (line.match(/^<\/\w/)) {
        if (pad !== 0) {
          pad -= 1;
        }
      } else if (line.match(/^<\w[^>]*[^\/]>.*$/)) {
        indent = 1;
      } else {
        indent = 0;
      }
      
      const padding = PADDING.repeat(pad);
      pad += indent;
      return padding + line;
    }).join('\n');
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(rule.originalXml).then(() => {
      // You could add a toast notification here
      alert('XML copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy XML:', err);
    });
  };

  return (
    <div className="xml-popup-backdrop" onClick={handleBackdropClick}>
      <div className="xml-popup-modal">
        <div className="xml-popup-header">
          <h3>Rule {rule.id} - Original XML</h3>
          <div className="xml-popup-actions">
            <button onClick={handleCopyToClipboard} className="copy-button">
              Copy XML
            </button>
            <button onClick={onClose} className="close-button">
              ×
            </button>
          </div>
        </div>
        <div className="xml-popup-content">
          <pre className="xml-content">
            <code>{formatXml(rule.originalXml)}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

function Timeline({
  rules, year, highlightedRuleIds, bookingCreationDate,
  viewMode, selectedMonth, onMonthClick, onNavigateMonth, onBackToYear,
  saleabilityData, isDarkMode, ruleYears
}) {
  const isYearView = viewMode === 'year';
  const [selectedRule, setSelectedRule] = useState(null); // For XML popup

  // 1. 用 ref 拿 info 和 bar 宽度
  const infoRef = useRef(null);
  const barRef = useRef(null);
  const [infoWidth, setInfoWidth] = useState(0);
  const [barWidth, setBarWidth] = useState(0);

  // 2. 自动监听窗口变化，动态获取宽度
  useEffect(() => {
    function updateWidths() {
      if (infoRef.current) setInfoWidth(infoRef.current.offsetWidth);
      if (barRef.current) setBarWidth(barRef.current.offsetWidth);
    }
    updateWidths();
    window.addEventListener('resize', updateWidths);
    return () => window.removeEventListener('resize', updateWidths);
  }, []);

  // 3. 时间范围
  const { start, end, totalDays } = useMemo(() => {
    if (isYearView) {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      return {
        start: yearStart,
        end: yearEnd,
        totalDays: differenceInCalendarDays(yearEnd, yearStart) + 1
      };
    } else {
      const monthStart = new Date(year, selectedMonth, 1);
      const monthEnd = new Date(year, selectedMonth + 1, 0);
      return {
        start: monthStart,
        end: monthEnd,
        totalDays: differenceInCalendarDays(monthEnd, monthStart) + 1
      };
    }
  }, [year, selectedMonth, isYearView]);

  // 4. Header ticks
  const headerTicks = useMemo(() => {
    const ticks = [];
    if (isYearView) {
      for (let month = 0; month < 12; month++) {
        const date = new Date(year, month, 1);
        const idx = differenceInCalendarDays(date, start);
        ticks.push({
          index: idx,
          label: date.toLocaleString('default', { month: 'short' }),
          month,
          clickable: true
        });
      }
    } else {
      for (let day = 1; day <= totalDays; day++) {
        ticks.push({
          index: day - 1,
          label: day.toString(),
          clickable: false
        });
      }
    }
    return ticks;
  }, [year, start, isYearView, selectedMonth, totalDays]);

  // 5. booking creation 红线逻辑
  const bookingDatePosition = useMemo(() => {
    if (!bookingCreationDate) return null;
    const dayIndex = differenceInCalendarDays(bookingCreationDate, start);
    if (dayIndex < 0 || dayIndex >= totalDays) return null;
    return (dayIndex / totalDays) * 100; // Return percentage directly
  }, [bookingCreationDate, start, totalDays]);

  return (
    <div className="timeline-wrapper">
      {/* Month nav */}
      {!isYearView && (
        <div className="timeline-navigation">
          <button
            onClick={() => onNavigateMonth(-1)}
            disabled={selectedMonth === 0 && (!ruleYears || year <= ruleYears.min)}
            className="nav-button"
          >
            ← Previous
          </button>
          <span className="current-month">
            {new Date(year, selectedMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => onNavigateMonth(1)}
            disabled={selectedMonth === 11 && (!ruleYears || year >= ruleYears.max)}
            className="nav-button"
          >
            Next →
          </button>
          <button onClick={onBackToYear} className="back-button">
            Back to Year View
          </button>
        </div>
      )}
      {/* Header */}
      <div className="timeline-header" style={{ display: 'flex' }}>
        <div
          className="rule-info-spacer"
          ref={infoRef}
          style={{ width: '30%', minWidth: '200px', maxWidth: '300px' }}
        ></div>
        <div
          className="timeline-markers-container"
          ref={barRef}
          style={{ flex: 1, position: 'relative' }}
        >
          {headerTicks.map((tick) => (
            <div
              key={tick.index}
              className={`timeline-marker ${tick.clickable ? 'clickable' : ''}`}
              style={{ left: `${(tick.index / totalDays) * 100}%` }}
              onClick={tick.clickable ? () => onMonthClick(tick.month) : undefined}
              title={tick.clickable ? `Click to view ${tick.label} in detail` : undefined}
            >
              {tick.label}
            </div>
          ))}
          {/* 红线，绝对定位 */}
          {bookingDatePosition !== null && (
            <div
              className="booking-creation-line"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${bookingDatePosition}%`
              }}
              title={`Booking creation date: ${format(bookingCreationDate, 'yyyy-MM-dd')}`}
            >
              <div className="booking-creation-label">
                {format(bookingCreationDate, 'MMM d')}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* rule bar rows */}
      <div className="rule-rows">
        {/* Availability overlay */}
        {saleabilityData && (
          <div className="availability-overlay-row">
            <div className="rule-info">
              <div className="rule-title">Saleability From APEX</div>
              <div className="rule-dates">Saleable dates</div>
              <div className="rule-details">{isDarkMode ? 'White' : 'Black'} = Saleable</div>
            </div>
            <div className="rule-bar-container">
              {/* Render availability blocks */}
              {Array.from({ length: totalDays }, (_, dayIndex) => {
                const currentDate = new Date(start);
                currentDate.setDate(currentDate.getDate() + dayIndex);
                const dateKey = format(currentDate, 'yyyy-MM-dd');
                
                // Check if this date has any availability
                const hasAvailability = saleabilityData.data?.saleability?.[dateKey] && 
                                      saleabilityData.data.saleability[dateKey].length > 0;
                
                if (hasAvailability) {
                  const barLeft = (dayIndex / totalDays) * 100;
                  const barWidth = (1 / totalDays) * 100;
                  
                  return (
                    <div
                      key={dayIndex}
                      className="available-day"
                      style={{
                        left: `${barLeft}%`,
                        width: `${barWidth}%`,
                      }}
                      title={`${dateKey} - Available`}
                    />
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}
        
        {rules.map((rule) => {
          let ruleStartIdx = differenceInCalendarDays(parseISO(rule.from), start);
          let ruleEndIdx = differenceInCalendarDays(parseISO(rule.to), start);
          
          // Also check if maxDaysToArrival period intersects with current view
          let shadowStartIdx = null;
          let shadowEndIdx = null;
          if (rule.maxDaysToArrival != null) {
            const ruleFromDate = parseISO(rule.from);
            const shadowEnd = new Date(ruleFromDate);
            shadowEnd.setDate(shadowEnd.getDate() - 1); // End one day before rule starts
            const shadowStart = new Date(shadowEnd);
            shadowStart.setDate(shadowStart.getDate() - rule.maxDaysToArrival + 1); // X days before the end
            
            shadowStartIdx = differenceInCalendarDays(shadowStart, start);
            shadowEndIdx = differenceInCalendarDays(shadowEnd, start);
          }
          
          // Show rule if either the rule period OR the maxDaysToArrival period intersects with current view
          const ruleIntersects = !(ruleEndIdx < 0 || ruleStartIdx > totalDays - 1);
          const shadowIntersects = shadowStartIdx !== null && shadowEndIdx !== null && 
                                  !(shadowEndIdx < 0 || shadowStartIdx > totalDays - 1);
          
          if (!ruleIntersects && !shadowIntersects) return null;
          
          ruleStartIdx = Math.max(0, ruleStartIdx);
          ruleEndIdx = Math.min(totalDays - 1, ruleEndIdx);
          const barLeft = (ruleStartIdx / totalDays) * 100;
          const barWidthPercent = ((ruleEndIdx - ruleStartIdx + 1) / totalDays) * 100;
          const highlight = highlightedRuleIds && highlightedRuleIds.includes(rule.id);
          
          // Calculate max days to arrival shadow if applicable
          let shadowOverlay = null;
          if (rule.maxDaysToArrival != null && shadowIntersects) {
            // Use the already calculated shadow indices
            const visibleStartIdx = Math.max(0, shadowStartIdx);
            const visibleEndIdx = Math.min(totalDays - 1, shadowEndIdx);
            
            if (visibleStartIdx <= visibleEndIdx) {
              const shadowLeft = (visibleStartIdx / totalDays) * 100;
              const shadowWidth = ((visibleEndIdx - visibleStartIdx + 1) / totalDays) * 100;
              
              const ruleFromDate = parseISO(rule.from);
              const shadowEnd = new Date(ruleFromDate);
              shadowEnd.setDate(shadowEnd.getDate() - 1);
              const shadowStart = new Date(shadowEnd);
              shadowStart.setDate(shadowStart.getDate() - rule.maxDaysToArrival + 1);
              
              shadowOverlay = (
                <div
                  className="max-days-shadow"
                  style={{
                    left: `${shadowLeft}%`,
                    width: `${shadowWidth}%`,
                  }}
                  title={`Booking window (${rule.maxDaysToArrival} days): ${format(shadowStart, 'MMM d, yyyy')} to ${format(shadowEnd, 'MMM d, yyyy')} for rule starting ${format(ruleFromDate, 'MMM d, yyyy')}`}
                />
              );
            }
          }
          
          return (
            <div className="rule-row" key={rule.id}>
              <div 
                className="rule-info clickable-rule"
                onClick={() => setSelectedRule(rule)}
                title="Click to view original XML"
              >
                <div className="rule-title">Rule {rule.id}</div>
                <div className="rule-dates">
                  {format(parseISO(rule.from), 'yyyy-MM-dd')} – {format(parseISO(rule.to), 'yyyy-MM-dd')}
                </div>
                <div className="rule-details">
                  Min stay {rule.minStay}, Max stay {rule.maxStay}
                  {rule.maxDaysToArrival != null
                    ? `, Max days to arrival ${rule.maxDaysToArrival}`
                    : ', No max days to arrival'}
                </div>
              </div>
              <div className="rule-bar-container">
                {shadowOverlay}
                {ruleIntersects && (
                  <div
                    className={`rule-bar ${highlight ? 'highlight' : ''} clickable-rule`}
                    style={{
                      left: `${barLeft}%`,
                      width: `${barWidthPercent}%`,
                      backgroundColor: rule.colour,
                    }}
                    title={`Rule ${rule.id} - Click to view XML`}
                    onClick={() => setSelectedRule(rule)}
                  ></div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* XML Popup Modal */}
      {selectedRule && (
        <XMLPopup 
          rule={selectedRule} 
          onClose={() => setSelectedRule(null)} 
        />
      )}
    </div>
  );
}


/**
 * API Configuration component for setting up API endpoint and making requests
 */
function APIConfiguration({ onRulesLoaded, searchHistory, onAddToHistory, onSaleabilityLoaded, saleabilityData }) {
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

/**
 * CheckoutTester allows users to test checkout availability for specific bookings
 */
function CheckoutTester() {
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

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const result = await testCheckoutAvailability(trimmedPropertyCode, trimmedStartDate, parseInt(trimmedLengthOfStay, 10));
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
              value={lengthOfStay}
              onChange={(e) => setLengthOfStay(e.target.value)}
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
                const checkIn = new Date(startDate);
                const checkOut = new Date(checkIn);
                checkOut.setDate(checkIn.getDate() + parseInt(lengthOfStay, 10));
                return checkOut.toISOString().split('T')[0];
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

/**
 * BookingSelector allows users to test arbitrary bookings against the
 * uploaded rules. Users can dynamically add or remove test cases
 * consisting of a start date and a length of stay. Results for each
 * test case are displayed inline.
 */
function BookingSelector({ bookingDate, onBookingDateChange, bookingEntries, setBookingEntries, rules }) {
  // Update a specific booking entry field
  const updateEntry = (index, field, value) => {
    const updated = bookingEntries.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry));
    setBookingEntries(updated);
  };
  // Add a new empty test row
  const addEntry = () => {
    setBookingEntries([...bookingEntries, { startDate: '', length: '' }]);
  };
  // Remove a specific test row
  const removeEntry = (index) => {
    const updated = bookingEntries.filter((_, i) => i !== index);
    setBookingEntries(updated);
  };

  return (
    <div className="booking-selector">
      <h2>Test bookings</h2>
      <div className="booking-date-input">
        <label>
          Booking creation date:
          <input
            type="date"
            value={format(bookingDate, 'yyyy-MM-dd')}
            onChange={(e) => onBookingDateChange(parseISO(e.target.value))}
          />
        </label>
      </div>
      {bookingEntries.map((entry, index) => {
        const startDateIso = entry.startDate;
        const length = parseInt(entry.length, 10);
        let allowedRules = [];
        if (entry.startDate && entry.length) {
          allowedRules = rules.filter((rule) =>
            isBookingAllowedByRule(rule, startDateIso, length, bookingDate)
          );
        }
        return (
          <div key={index} className="booking-entry">
            <label>
              Start date:
              <input
                type="date"
                value={entry.startDate}
                onChange={(e) => updateEntry(index, 'startDate', e.target.value)}
              />
            </label>
            <label>
              Length of stay (nights):
              <input
                type="number"
                min="1"
                value={entry.length}
                onChange={(e) => updateEntry(index, 'length', e.target.value)}
              />
            </label>
            <button onClick={() => removeEntry(index)} disabled={bookingEntries.length === 1}>
              Remove
            </button>
            <div className="booking-result">
              {entry.startDate && entry.length ? (
                allowedRules.length > 0 ? (
                  <span className="allowed">
                    ✓ Allowed by rule{allowedRules.length > 1 ? 's' : ''} {allowedRules.map((r) => r.id).join(', ')}
                  </span>
                ) : (
                  <span className="not-allowed">✗ Not allowed by any rule</span>
                )
              ) : (
                <span className="enter-data">Enter start date and length</span>
              )}
            </div>
          </div>
        );
      })}
      <button onClick={addEntry}>Add booking test</button>
    </div>
  );
}

/**
 * Main application component. Coordinates the upload of rules, state
 * management, and renders the various child components.
 */
export default function App() {
  const [rules, setRules] = useState([]);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [bookingDate, setBookingDate] = useState(() => new Date());
  const [bookingEntries, setBookingEntries] = useState([{ startDate: '', length: '' }]);
  const [viewMode, setViewMode] = useState('year'); // 'year' or 'month'
  const [selectedMonth, setSelectedMonth] = useState(0); // 0-11
  const [isDarkMode, setIsDarkMode] = useState(false); // Default to light mode
  const [searchHistory, setSearchHistory] = useState([]); // Search history state
  const [saleabilityData, setSaleabilityData] = useState(null); // Saleability data state

  // Apply theme to body
  useEffect(() => {
    document.body.className = isDarkMode ? 'dark-theme' : 'light-theme';
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Handle month click to switch to day view
  const handleMonthClick = (month) => {
    setSelectedMonth(month);
    setViewMode('month');
  };

  // Handle navigation between months in day view
  const navigateMonth = (direction) => {
    const newMonth = selectedMonth + direction;
    
    if (newMonth >= 0 && newMonth <= 11) {
      // Normal month navigation within the same year
      setSelectedMonth(newMonth);
    } else if (newMonth === 12 && direction === 1) {
      // Moving from December to January of next year
      const nextYear = year + 1;
      if (ruleYears && nextYear <= ruleYears.max) {
        setYear(nextYear);
        setSelectedMonth(0); // January
      }
    } else if (newMonth === -1 && direction === -1) {
      // Moving from January to December of previous year
      const prevYear = year - 1;
      if (ruleYears && prevYear >= ruleYears.min) {
        setYear(prevYear);
        setSelectedMonth(11); // December
      }
    }
  };

  // Handle back to year view
  const handleBackToYear = () => {
    setViewMode('year');
  };
  // When booking entries change, compute which rules are matched to highlight them on the timeline
  const highlightedRuleIds = useMemo(() => {
    const ids = [];
    bookingEntries.forEach((entry) => {
      if (!entry.startDate || !entry.length) return;
      const length = parseInt(entry.length, 10);
      rules.forEach((rule) => {
        if (isBookingAllowedByRule(rule, entry.startDate, length, bookingDate)) {
          if (!ids.includes(rule.id)) {
            ids.push(rule.id);
          }
        }
      });
    });
    return ids;
  }, [bookingEntries, rules, bookingDate]);

  // Handle file upload and parse rules
  const handleFileChange = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseXmlRules(text);
      setRules(parsed);
      
      // Set year to the minimum year from the uploaded rules
      if (parsed && parsed.length > 0) {
        let minYear = Infinity;
        parsed.forEach((rule) => {
          const fromYear = parseISO(rule.from).getFullYear();
          const toYear = parseISO(rule.to).getFullYear();
          if (fromYear < minYear) minYear = fromYear;
          if (toYear < minYear) minYear = toYear;
        });
        if (minYear !== Infinity) {
          setYear(minYear);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Failed to parse the uploaded file. Please ensure it is valid XML containing price rules.');
    }
  };

  // Handle rules loaded from API
  const handleRulesLoaded = (loadedRules) => {
    setRules(loadedRules);
    
    // Set year to the minimum year from the loaded rules
    if (loadedRules && loadedRules.length > 0) {
      let minYear = Infinity;
      loadedRules.forEach((rule) => {
        const fromYear = parseISO(rule.from).getFullYear();
        const toYear = parseISO(rule.to).getFullYear();
        if (fromYear < minYear) minYear = fromYear;
        if (toYear < minYear) minYear = toYear;
      });
      if (minYear !== Infinity) {
        setYear(minYear);
      }
    }
  };

  // Handle adding to search history
  const handleAddToHistory = (searchItem) => {
    setSearchHistory(prev => {
      // Check if this combination already exists
      const exists = prev.some(item => 
        item.accommodationCode === searchItem.accommodationCode && 
        item.season === searchItem.season
      );
      
      if (exists) {
        return prev; // Don't add duplicates
      }
      
      // Add new item to the end and limit to last 5 searches (keep only the 5 most recent)
      const newHistory = [...prev, searchItem];
      return newHistory.slice(-5); // Keep only the last 5 items
    });
  };

  // Handle saleability data loaded
  const handleSaleabilityLoaded = (saleabilityData) => {
    setSaleabilityData(saleabilityData);
  };

  // Determine earliest and latest years covered by rules to provide guidance in the UI
  const ruleYears = useMemo(() => {
    if (!rules || rules.length === 0) return null;
    let minYear = Infinity;
    let maxYear = -Infinity;
    rules.forEach((r) => {
      const fromYear = parseISO(r.from).getFullYear();
      const toYear = parseISO(r.to).getFullYear();
      if (fromYear < minYear) minYear = fromYear;
      if (toYear > maxYear) maxYear = toYear;
    });
    return { min: minYear, max: maxYear };
  }, [rules]);

  return (
    <div className="container">
      <div className="header-section">
        <h1>Price Rule Debugger</h1>
        <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}>
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>
      <p>
        Upload your price rule file (XML) or fetch rules from API to visualise how the rules cover the calendar and test
        bookings against them.
      </p>
      
      {/* API Configuration Section */}
      <APIConfiguration 
        onRulesLoaded={handleRulesLoaded}
        searchHistory={searchHistory}
        onAddToHistory={handleAddToHistory}
        onSaleabilityLoaded={handleSaleabilityLoaded}
        saleabilityData={saleabilityData}
      />
      
      {/* File Upload Section */}
      <div className="upload-section">
        <h3>Or upload XML file</h3>
        <input type="file" accept=".xml" onChange={handleFileChange} />
      </div>
      
      {/* Checkout Tester - Available immediately */}
      <CheckoutTester />
      
      {rules.length > 0 && (
        <>
          <div className="year-selector">
            <span className="year-label">Display year:</span>
            <div className="year-navigation">
              <button 
                className="year-nav-button"
                onClick={() => setYear(year - 1)}
                disabled={ruleYears && year <= ruleYears.min}
                title="Previous year"
              >
                ←
              </button>
              <span className="current-year">{year}</span>
              <button 
                className="year-nav-button"
                onClick={() => setYear(year + 1)}
                disabled={ruleYears && year >= ruleYears.max}
                title="Next year"
              >
                →
              </button>
            </div>
            {ruleYears && (
              <span className="year-hint">
                (Available: {ruleYears.min} – {ruleYears.max})
              </span>
            )}
          </div>
          <Timeline 
            rules={rules} 
            year={year} 
            highlightedRuleIds={highlightedRuleIds} 
            bookingCreationDate={bookingDate}
            viewMode={viewMode}
            selectedMonth={selectedMonth}
            onMonthClick={handleMonthClick}
            onNavigateMonth={navigateMonth}
            onBackToYear={handleBackToYear}
            saleabilityData={saleabilityData}
            isDarkMode={isDarkMode}
            ruleYears={ruleYears}
          />
          <BookingSelector
            bookingDate={bookingDate}
            onBookingDateChange={setBookingDate}
            bookingEntries={bookingEntries}
            setBookingEntries={setBookingEntries}
            rules={rules}
          />
        </>
      )}
    </div>
  );
}