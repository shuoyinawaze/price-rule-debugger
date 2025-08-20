import { parseISO, differenceInCalendarDays, isAfter, isBefore } from 'date-fns';
import { COLOURS } from './constants.js';

/**
 * Parse XML into an array of rule objects. Each rule object
 * normalises the dates into ISO strings and assigns a colour.
 * @param {string} text The raw XML string
 * @returns {Array} An array of rule objects
 */
export function parseXmlRules(text) {
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
export function isBookingAllowedByRule(rule, startDate, length, bookingCreationDate) {
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
