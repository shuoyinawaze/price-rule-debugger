import React from 'react';
import { format, parseISO } from 'date-fns';
import { isBookingAllowedByRule } from '../utils/ruleUtils.js';

/**
 * BookingSelector allows users to test arbitrary bookings against the
 * uploaded rules. Users can dynamically add or remove test cases
 * consisting of a start date and a length of stay. Results for each
 * test case are displayed inline.
 */
export default function BookingSelector({ bookingDate, onBookingDateChange, bookingEntries, setBookingEntries, rules }) {
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
