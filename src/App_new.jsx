import React, { useEffect, useState, useMemo } from 'react';
import { parseISO } from 'date-fns';
import './App.css';

// Import components
import APIConfiguration from './components/APIConfiguration.jsx';
import CheckoutTester from './components/CheckoutTester.jsx';
import BookingSelector from './components/BookingSelector.jsx';
import Timeline from './components/Timeline.jsx';

// Import utilities
import { parseXmlRules, isBookingAllowedByRule } from './utils/ruleUtils.js';

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
      
      {/* Checkout Tester - At the bottom of the page */}
      <CheckoutTester />
    </div>
  );
}
